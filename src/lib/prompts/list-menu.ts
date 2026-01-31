/**
 * Unified List Menu Component
 *
 * A wrapper around inquirer's select/list prompts providing:
 * - Consistent choice formatting
 * - Built-in pagination with configurable page size
 * - Optional fuzzy filtering/search
 * - Multi-select mode variant
 * - Async choice loading with loading state
 * - Priority grouping/separators
 * - JSON mode support for AI agent consumers
 * - Empty state messaging
 *
 * @example
 * ```typescript
 * // Simple usage
 * const ticket = await listMenu({
 *   message: 'Select ticket:',
 *   choices: tickets,
 *   format: (t) => `${t.id} - ${t.title}`,
 *   pageSize: 15,
 * });
 *
 * // With priority grouping
 * const ticket = await listMenu({
 *   message: 'Select ticket:',
 *   choices: tickets,
 *   format: (t) => `${t.id} - ${t.title}`,
 *   groupBy: (t) => t.priority || 'None',
 * });
 *
 * // With async loading
 * const ticket = await listMenu({
 *   message: 'Select ticket:',
 *   choices: () => fetchTickets(),
 *   format: (t) => `${t.id} - ${t.title}`,
 * });
 *
 * // Multi-select
 * const tickets = await listMenuMulti({
 *   message: 'Select tickets:',
 *   choices: tickets,
 *   format: (t) => `${t.id} - ${t.title}`,
 * });
 * ```
 */

import inquirer from 'inquirer'
import {
  shouldOutputJson,
  outputPromptAsJson,
  outputErrorAsJson,
  createMetadata,
  type JsonFlags,
  type OutputMetadata,
  type PromptChoice,
} from '../prompt-json.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for JSON mode output
 */
export interface ListMenuJsonMode {
  /** Command flags for JSON detection */
  flags: JsonFlags & Record<string, unknown>
  /** Command name for metadata */
  commandName: string
}

/**
 * Base options shared between single and multi-select menus
 */
export interface ListMenuBaseOptions<T> {
  /** Prompt message shown to user */
  message: string

  /**
   * Items to select from, or async function that returns items.
   * If a function is provided, a loading indicator is shown while waiting.
   */
  choices: T[] | (() => Promise<T[]>)

  /**
   * Format an item for display.
   * If not provided, uses String(item) for primitives or item.name if available.
   */
  format?: (item: T, index: number) => string

  /**
   * Extract the value to return when item is selected.
   * If not provided, returns the item itself.
   */
  getValue?: (item: T) => string | T

  /**
   * Build command string for item (should include --json flag).
   * Used in JSON mode to provide AI agents with follow-up commands.
   */
  getCommand?: (item: T) => string

  /**
   * Group items by a key. Items with the same key are grouped together
   * with a separator header showing the group name.
   */
  groupBy?: (item: T) => string

  /**
   * Custom order for groups. Groups not in this list appear at the end.
   * @default alphabetical order
   */
  groupOrder?: string[]

  /**
   * Page size for pagination.
   * @default 15
   */
  pageSize?: number

  /**
   * Message to show when there are no items.
   * If provided and items array is empty, this message is logged and function returns null.
   */
  emptyMessage?: string

  /**
   * JSON mode configuration.
   * If provided and flags indicate JSON mode, outputs prompt schema instead of prompting.
   */
  jsonMode?: ListMenuJsonMode | null

  /**
   * Allow user to cancel the selection.
   * Adds a separator and "Cancel" option at the end.
   */
  allowCancel?: boolean

  /**
   * Custom cancel option label.
   * @default 'Cancel'
   */
  cancelLabel?: string
}

/**
 * Options for single-select list menu
 */
export interface ListMenuOptions<T> extends ListMenuBaseOptions<T> {
  /**
   * Default selected value (by value, not display name)
   */
  defaultValue?: string | T
}

/**
 * Options for multi-select list menu
 */
export interface ListMenuMultiOptions<T> extends ListMenuBaseOptions<T> {
  /**
   * Minimum number of selections required.
   * @default 1
   */
  minSelections?: number

  /**
   * Maximum number of selections allowed.
   * @default unlimited
   */
  maxSelections?: number

  /**
   * Pre-selected values (by value, not display name)
   */
  defaultValues?: (string | T)[]

  /**
   * Validation function for selections.
   * Return true if valid, or an error message string.
   */
  validate?: (selections: T[]) => boolean | string
}

/**
 * Result from list menu operations
 */
export interface ListMenuResult<T> {
  /** Selected item(s) - null if cancelled or empty */
  value: T | T[] | null
  /** Whether user cancelled the selection */
  cancelled: boolean
  /** Whether the menu was shown in JSON mode (process exits, no result) */
  jsonMode?: boolean
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Default formatter for items
 */
function defaultFormat<T>(item: T): string {
  if (typeof item === 'string') return item
  if (typeof item === 'number') return String(item)
  if (item && typeof item === 'object') {
    // Try common name properties
    const obj = item as Record<string, unknown>
    if (typeof obj.name === 'string') return obj.name
    if (typeof obj.title === 'string') return obj.title
    if (typeof obj.label === 'string') return obj.label
    if (typeof obj.id === 'string') return obj.id
  }
  return String(item)
}

/**
 * Default value extractor
 */
function defaultGetValue<T>(item: T): T | string {
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>
    if (typeof obj.id === 'string') return obj.id
    if (obj.value !== undefined) return obj.value as string
  }
  return item
}

/**
 * Build choices array from items with optional grouping
 */
function buildChoices<T>(
  items: T[],
  options: {
    format: (item: T, index: number) => string
    getValue: (item: T) => string | T
    getCommand?: (item: T) => string
    groupBy?: (item: T) => string
    groupOrder?: string[]
  }
): Array<{ name: string; value: string | T; command?: string } | inquirer.Separator> {
  const { format, getValue, getCommand, groupBy, groupOrder } = options
  const choices: Array<{ name: string; value: string | T; command?: string } | inquirer.Separator> = []

  if (!groupBy) {
    // No grouping - simple list
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      choices.push({
        name: format(item, i),
        value: getValue(item),
        ...(getCommand ? { command: getCommand(item) } : {}),
      })
    }
    return choices
  }

  // Group items
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = groupBy(item)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }

  // Sort groups
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (groupOrder) {
      const aIndex = groupOrder.indexOf(a)
      const bIndex = groupOrder.indexOf(b)
      // Items in groupOrder come first, in specified order
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
    }
    // Alphabetical fallback
    return a.localeCompare(b)
  })

  // Build grouped choices
  let globalIndex = 0
  for (const key of sortedKeys) {
    const groupItems = groups.get(key)!
    if (groupItems.length === 0) continue

    // Add separator for group
    choices.push(new inquirer.Separator(`── ${key} (${groupItems.length}) ──`))

    // Add items in group
    for (const item of groupItems) {
      choices.push({
        name: format(item, globalIndex),
        value: getValue(item),
        ...(getCommand ? { command: getCommand(item) } : {}),
      })
      globalIndex++
    }
  }

  return choices
}

/**
 * Build JSON choices for prompt output
 */
function buildJsonChoices<T>(
  items: T[],
  options: {
    format: (item: T, index: number) => string
    getValue: (item: T) => string | T
    getCommand?: (item: T) => string
  }
): PromptChoice[] {
  const { format, getValue, getCommand } = options
  return items.map((item, index) => ({
    name: format(item, index),
    value: String(getValue(item)),
    ...(getCommand ? { command: getCommand(item) } : {}),
  }))
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Display a single-select list menu.
 *
 * @returns The selected item, or null if cancelled/empty
 */
export async function listMenu<T>(options: ListMenuOptions<T>): Promise<T | null> {
  const {
    message,
    choices: choicesInput,
    format = defaultFormat,
    getValue = defaultGetValue,
    getCommand,
    groupBy,
    groupOrder,
    pageSize = 15,
    emptyMessage,
    jsonMode,
    allowCancel = false,
    cancelLabel = 'Cancel',
    defaultValue,
  } = options

  // Resolve choices (handle async)
  let items: T[]
  if (typeof choicesInput === 'function') {
    // Show loading indicator in interactive mode
    const isJson = jsonMode && shouldOutputJson(jsonMode.flags)
    if (!isJson) {
      process.stdout.write('Loading...')
    }
    try {
      items = await choicesInput()
      if (!isJson) {
        // Clear loading message
        process.stdout.clearLine?.(0)
        process.stdout.cursorTo?.(0)
      }
    } catch (error) {
      if (!isJson) {
        process.stdout.clearLine?.(0)
        process.stdout.cursorTo?.(0)
      }
      if (jsonMode && shouldOutputJson(jsonMode.flags)) {
        outputErrorAsJson(
          'LOAD_FAILED',
          `Failed to load choices: ${error instanceof Error ? error.message : String(error)}`,
          createMetadata(jsonMode.commandName, jsonMode.flags)
        )
      }
      throw error
    }
  } else {
    items = choicesInput
  }

  // Handle empty state
  if (items.length === 0) {
    if (jsonMode && shouldOutputJson(jsonMode.flags)) {
      outputErrorAsJson(
        'NO_ITEMS',
        emptyMessage || 'No items available',
        createMetadata(jsonMode.commandName, jsonMode.flags)
      )
    }
    if (emptyMessage) {
      console.log(emptyMessage)
    }
    return null
  }

  // Handle JSON mode
  if (jsonMode && shouldOutputJson(jsonMode.flags)) {
    const jsonChoices = buildJsonChoices(items, { format, getValue, getCommand })
    outputPromptAsJson(
      {
        type: 'list',
        name: 'selection',
        message,
        choices: jsonChoices,
        ...(defaultValue !== undefined ? { default: String(getValue(defaultValue as T)) } : {}),
      },
      createMetadata(jsonMode.commandName, jsonMode.flags)
    )
    // outputPromptAsJson exits process, this is unreachable
    return null
  }

  // Build interactive choices
  const interactiveChoices = buildChoices(items, {
    format,
    getValue,
    getCommand,
    groupBy,
    groupOrder,
  })

  // Add cancel option if requested
  if (allowCancel) {
    interactiveChoices.push(
      new inquirer.Separator('─'.repeat(20)),
      { name: cancelLabel, value: '__cancel__' as unknown as T }
    )
  }

  // Find default value index
  let defaultIndex: number | undefined
  // eslint-disable-next-line unicorn/no-typeof-undefined
  if (typeof defaultValue !== 'undefined') {
    const targetValue = getValue(defaultValue as T)
    defaultIndex = interactiveChoices.findIndex(
      (c) => !(c instanceof inquirer.Separator) && c.value === targetValue
    )
    if (defaultIndex === -1) defaultIndex = undefined
  }

  // Show prompt
  const { selection } = await inquirer.prompt<{ selection: T | string }>([
    {
      type: 'list',
      name: 'selection',
      message,
      choices: interactiveChoices,
      pageSize,
      ...(defaultIndex !== undefined ? { default: defaultIndex } : {}),
    },
  ])

  // Handle cancel
  if (selection === '__cancel__') {
    return null
  }

  // Return selected item (not just value)
  // Find the original item that matches the selection
  const selectedValue = selection
  const selectedItem = items.find((item) => getValue(item) === selectedValue)
  return selectedItem ?? (selection as unknown as T)
}

/**
 * Display a multi-select list menu.
 *
 * @returns Array of selected items, or null if cancelled/empty
 */
export async function listMenuMulti<T>(options: ListMenuMultiOptions<T>): Promise<T[] | null> {
  const {
    message,
    choices: choicesInput,
    format = defaultFormat,
    getValue = defaultGetValue,
    getCommand,
    groupBy,
    groupOrder,
    pageSize = 15,
    emptyMessage,
    jsonMode,
    minSelections = 1,
    maxSelections,
    defaultValues,
    validate,
  } = options

  // Resolve choices (handle async)
  let items: T[]
  if (typeof choicesInput === 'function') {
    const isJson = jsonMode && shouldOutputJson(jsonMode.flags)
    if (!isJson) {
      process.stdout.write('Loading...')
    }
    try {
      items = await choicesInput()
      if (!isJson) {
        process.stdout.clearLine?.(0)
        process.stdout.cursorTo?.(0)
      }
    } catch (error) {
      if (!isJson) {
        process.stdout.clearLine?.(0)
        process.stdout.cursorTo?.(0)
      }
      if (jsonMode && shouldOutputJson(jsonMode.flags)) {
        outputErrorAsJson(
          'LOAD_FAILED',
          `Failed to load choices: ${error instanceof Error ? error.message : String(error)}`,
          createMetadata(jsonMode.commandName, jsonMode.flags)
        )
      }
      throw error
    }
  } else {
    items = choicesInput
  }

  // Handle empty state
  if (items.length === 0) {
    if (jsonMode && shouldOutputJson(jsonMode.flags)) {
      outputErrorAsJson(
        'NO_ITEMS',
        emptyMessage || 'No items available',
        createMetadata(jsonMode.commandName, jsonMode.flags)
      )
    }
    if (emptyMessage) {
      console.log(emptyMessage)
    }
    return null
  }

  // Handle JSON mode
  if (jsonMode && shouldOutputJson(jsonMode.flags)) {
    const jsonChoices = buildJsonChoices(items, { format, getValue, getCommand })
    outputPromptAsJson(
      {
        type: 'checkbox',
        name: 'selections',
        message,
        choices: jsonChoices,
        ...(defaultValues ? { default: defaultValues.map((v) => String(getValue(v as T))) } : {}),
      },
      createMetadata(jsonMode.commandName, jsonMode.flags)
    )
    return null
  }

  // Build interactive choices
  const interactiveChoices = buildChoices(items, {
    format,
    getValue,
    getCommand,
    groupBy,
    groupOrder,
  })

  // Mark default selections
  if (defaultValues) {
    const defaultValueSet = new Set(defaultValues.map((v) => getValue(v as T)))
    for (const choice of interactiveChoices) {
      if (!(choice instanceof inquirer.Separator) && defaultValueSet.has(choice.value as string | T)) {
        (choice as { checked?: boolean }).checked = true
      }
    }
  }

  // Build validation function
  const validateFn = (input: (string | T)[]) => {
    if (input.length < minSelections) {
      return `Please select at least ${minSelections} item${minSelections > 1 ? 's' : ''}`
    }
    if (maxSelections !== undefined && input.length > maxSelections) {
      return `Please select at most ${maxSelections} item${maxSelections > 1 ? 's' : ''}`
    }
    if (validate) {
      // Find original items for validation
      const selectedItems = input
        .map((val) => items.find((item) => getValue(item) === val))
        .filter((item): item is T => item !== undefined)
      return validate(selectedItems)
    }
    return true
  }

  // Show prompt
  const { selections } = await inquirer.prompt<{ selections: (string | T)[] }>([
    {
      type: 'checkbox',
      name: 'selections',
      message,
      choices: interactiveChoices,
      pageSize,
      validate: validateFn,
    },
  ])

  // Return selected items (not just values)
  const selectedItems = selections
    .map((val) => items.find((item) => getValue(item) === val))
    .filter((item): item is T => item !== undefined)

  return selectedItems
}

// =============================================================================
// Convenience Exports
// =============================================================================

export { type PromptChoice, type OutputMetadata }
