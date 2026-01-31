/**
 * Unified list menu component
 *
 * Provides a consistent interactive selection experience across all CLI commands.
 * Wraps inquirer's list/checkbox prompts with:
 *   - Consistent choice formatting
 *   - Configurable pagination (pageSize controls visible rows; inquirer scrolls natively)
 *   - Optional grouping with separator headers
 *   - JSON mode: outputs prompt schema for AI agent consumers, then exits
 *   - Empty state handling with configurable messaging
 *
 * Usage:
 *   Generic:  listMenu({ items, format, getValue, message })
 *   Tickets:  ticketListMenu({ tickets, message })
 */

import inquirer from 'inquirer'
import { styles, formatPriority } from '../styles.js'
import {
  shouldOutputJson,
  outputPromptAsJson,
  buildPromptConfig,
  createMetadata,
} from '../prompt-json.js'
import { type Ticket } from '../pmo/types.js'

// ── Ordering ────────────────────────────────────────────────────

/** Standard priority display order for ticket grouping */
const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3', 'None']

// ── Interfaces ──────────────────────────────────────────────────

/**
 * Configuration for the generic list menu.
 * @template T - The type of items in the list
 */
export interface ListMenuOption<T> {
  /** Prompt message shown to the user */
  message: string
  /** Items to display */
  items: T[]
  /** Format an item for interactive display (may include chalk styling) */
  format: (item: T) => string
  /** Extract the return value from an item */
  getValue: (item: T) => string
  /** Number of visible rows before scrolling (default: 15) */
  pageSize?: number
  /** Group items by this key, inserting separator headers between groups */
  groupBy?: (item: T) => string
  /** Ordered list of group keys (controls section display order).
   *  Groups not listed here appear after the ordered ones. */
  groupOrder?: string[]
  /** Prompt type: 'list' for single-select, 'checkbox' for multi-select */
  mode?: 'list' | 'checkbox'
  /** Validation for checkbox mode. Return true to accept, or an error string. */
  validate?: (selected: string[]) => string | true
  /** JSON mode config. When active, outputs prompt schema instead of prompting. */
  jsonMode?: { flags: Record<string, unknown>; commandName: string } | null
  /** Build a CLI command string for each item (included in JSON mode output) */
  getCommand?: (item: T) => string
  /** Plain-text format for JSON output (no chalk codes). Falls back to format if omitted. */
  formatPlain?: (item: T) => string
  /** Message logged when items is empty. Omit to return silently. */
  emptyMessage?: string
  /** Logger for empty state messages (defaults to console.log) */
  log?: (msg: string) => void
}

/**
 * Options for the ticket-specific list menu.
 */
export interface TicketMenuOptions {
  /** Tickets to display */
  tickets: Ticket[]
  /** Prompt message */
  message: string
  /** Prompt type: 'list' for single-select, 'checkbox' for multi-select */
  mode?: 'list' | 'checkbox'
  /** Group tickets into P0 / P1 / P2 / P3 / None priority sections (default: true) */
  groupByPriority?: boolean
  /** Show status/column badge (default: true) */
  showStatus?: boolean
  /** Show assignee info (default: false) */
  showAssignee?: boolean
  /** Show project badge. 'auto' shows only when multiple projects exist (default: false) */
  showProject?: boolean | 'auto'
  /** Max display length for ticket title before truncation (default: 50) */
  titleLength?: number
  /** Number of visible rows before scrolling (default: 15) */
  pageSize?: number
  /** JSON mode config. When active, outputs prompt schema instead of prompting. */
  jsonMode?: { flags: Record<string, unknown>; commandName: string } | null
  /** Build a CLI command string for JSON mode choices */
  getCommand?: (ticket: Ticket) => string
  /** Validation for checkbox mode */
  validate?: (selected: string[]) => string | true
  /** Message logged when tickets list is empty */
  emptyMessage?: string
  /** Logger for messages */
  log?: (msg: string) => void
}

// ── Helpers (exported for testing) ─────────────────────────────

/**
 * Group items by a key function, respecting a prescribed display order.
 * Returns ordered [key, items] pairs. Groups with zero items are omitted.
 */
export function groupItems<T>(
  items: T[],
  keyFn: (item: T) => string,
  order?: string[]
): Array<[string, T[]]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  const keys = order
    ? [
        ...order.filter(k => groups.has(k)),
        ...Array.from(groups.keys()).filter(k => !order.includes(k)),
      ]
    : Array.from(groups.keys())

  return keys
    .map((k): [string, T[]] => [k, groups.get(k)!])
    .filter(([, groupMembers]) => groupMembers.length > 0)
}

/**
 * Format a ticket as plain text (no chalk styling).
 * Used for JSON mode output and is the basis for unit testing the display format.
 *
 * Canonical format: `[P0] TKT-001 - Title [In Progress] [project] (assignee)`
 */
export function formatTicketPlain(
  ticket: Ticket,
  options: {
    showStatus?: boolean
    showAssignee?: boolean
    showProject?: boolean
    titleLength?: number
  } = {}
): string {
  const {
    showStatus = true,
    showAssignee = false,
    showProject = false,
    titleLength = 50,
  } = options

  const priority = ticket.priority ? `[${ticket.priority}]` : '[None]'
  const title =
    ticket.title.length > titleLength
      ? ticket.title.substring(0, titleLength - 1) + '…'
      : ticket.title
  const parts = [priority, ticket.id, '-', title]

  if (showStatus && ticket.statusName) {
    parts.push(`[${ticket.statusName}]`)
  }
  if (showProject && ticket.projectName) {
    parts.push(`[${ticket.projectName}]`)
  }
  if (showAssignee) {
    parts.push(ticket.assignee ? `(${ticket.assignee})` : '(unassigned)')
  }
  return parts.join(' ')
}

// ── Generic list menu ───────────────────────────────────────────

/**
 * Generic list/checkbox menu.
 *
 * Handles pagination, optional grouping, JSON mode, and empty state.
 * Pagination for large lists (1000+) is handled natively by inquirer's
 * scrolling — pageSize controls how many rows are visible at once.
 *
 * @returns list mode → selected value or null if empty
 *          checkbox mode → array of selected values or [] if empty
 */
export function listMenu<T>(options: ListMenuOption<T> & { mode: 'checkbox' }): Promise<string[]>
export function listMenu<T>(options: ListMenuOption<T> & { mode?: 'list' }): Promise<string | null>
export async function listMenu<T>(
  options: ListMenuOption<T>
): Promise<string | string[] | null> {
  const {
    message,
    items,
    format,
    getValue,
    pageSize = 15,
    groupBy,
    groupOrder,
    mode = 'list',
    validate,
    jsonMode,
    getCommand,
    formatPlain,
    emptyMessage,
    log: logFn = console.log,
  } = options

  // ── Empty state ──────────────────────────────────────────────
  if (items.length === 0) {
    // In JSON mode the caller handles the error JSON output; don't log interactively.
    if (emptyMessage && !(jsonMode && shouldOutputJson(jsonMode.flags))) {
      logFn(emptyMessage)
    }
    return mode === 'checkbox' ? [] : null
  }

  // ── Build choices (with optional grouping) ──────────────────
  type Choice = { name: string; value: string; command?: string }

  function buildChoices(styled: boolean): Array<Choice | inquirer.Separator> {
    const fn = styled || !formatPlain ? format : formatPlain
    const choices: Array<Choice | inquirer.Separator> = []

    if (groupBy) {
      const grouped = groupItems(items, groupBy, groupOrder)
      for (const [key, groupMembers] of grouped) {
        choices.push(new inquirer.Separator(`── ${key} (${groupMembers.length}) ──`))
        for (const item of groupMembers) {
          const choice: Choice = { name: fn(item), value: getValue(item) }
          if (getCommand) choice.command = getCommand(item)
          choices.push(choice)
        }
      }
    } else {
      for (const item of items) {
        const choice: Choice = { name: fn(item), value: getValue(item) }
        if (getCommand) choice.command = getCommand(item)
        choices.push(choice)
      }
    }

    return choices
  }

  // ── JSON mode ────────────────────────────────────────────────
  if (jsonMode && shouldOutputJson(jsonMode.flags)) {
    const plainChoices = buildChoices(false)
    // Strip separators — they are visual only, not meaningful for agents
    const promptChoices = plainChoices.filter(
      (c): c is Choice => !(c instanceof inquirer.Separator)
    )

    outputPromptAsJson(
      buildPromptConfig(
        mode === 'checkbox' ? 'checkbox' : 'list',
        'selection',
        message,
        promptChoices
      ),
      createMetadata(jsonMode.commandName, jsonMode.flags)
    )
    // outputPromptAsJson calls process.exit — the lines below are unreachable
    // but satisfy the return-type contract for the compiler
    return mode === 'checkbox' ? [] : null
  }

  // ── Interactive mode ─────────────────────────────────────────
  const styledChoices = buildChoices(true)

  if (mode === 'checkbox') {
    const { selection } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selection',
        message,
        choices: styledChoices as Array<{ name: string; value: string } | inquirer.Separator>,
        pageSize,
        validate: validate as ((input: string[]) => string | boolean) | undefined,
      },
    ])
    return selection as string[]
  }

  const { selection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selection',
      message,
      choices: styledChoices as Array<{ name: string; value: string } | inquirer.Separator>,
      pageSize,
    },
  ])
  return selection as string
}

// ── Ticket list menu ────────────────────────────────────────────

/**
 * Unified ticket picker menu.
 *
 * Produces a consistent display format across every command that shows tickets:
 *   Interactive: `[P0] TKT-001 - Title [In Progress]`   (chalk-styled)
 *   JSON:        `[P0] TKT-001 - Title [In Progress]`   (plain text)
 *
 * Priority grouping is on by default, creating P0 → P1 → P2 → P3 → None sections
 * with separator headers. Pagination is handled by inquirer's native scrolling
 * (pageSize controls how many rows are visible).
 *
 * @returns list mode → selected ticket ID or null if empty
 *          checkbox mode → array of ticket IDs or [] if empty
 */
export function ticketListMenu(options: TicketMenuOptions & { mode: 'checkbox' }): Promise<string[]>
export function ticketListMenu(options: TicketMenuOptions & { mode?: 'list' }): Promise<string | null>
export async function ticketListMenu(
  options: TicketMenuOptions
): Promise<string | string[] | null> {
  const {
    tickets,
    message,
    mode = 'list',
    groupByPriority = true,
    showStatus = true,
    showAssignee = false,
    showProject = false,
    titleLength = 50,
    pageSize = 15,
    jsonMode,
    getCommand,
    validate,
    emptyMessage = styles.warning('No tickets found.'),
    log: logFn,
  } = options

  // Resolve 'auto' showProject: show project badge only when multiple projects are present
  const shouldShowProject =
    showProject === true ||
    (showProject === 'auto' &&
      new Set(tickets.map(t => t.projectId || t.projectName)).size > 1)

  const fmtOpts = { showStatus, showAssignee, showProject: shouldShowProject, titleLength }

  /** Chalk-styled format for interactive display */
  function formatStyled(ticket: Ticket): string {
    const priority = formatPriority(ticket.priority) || styles.muted('[None]')
    const id = styles.code(ticket.id)
    const title =
      ticket.title.length > titleLength
        ? ticket.title.substring(0, titleLength - 1) + '…'
        : ticket.title
    const parts = [priority, id, '-', title]

    if (showStatus && ticket.statusName) {
      parts.push(styles.muted(`[${ticket.statusName}]`))
    }
    if (shouldShowProject && ticket.projectName) {
      parts.push(styles.info(`[${ticket.projectName}]`))
    }
    if (showAssignee) {
      parts.push(
        styles.muted(ticket.assignee ? `(${ticket.assignee})` : '(unassigned)')
      )
    }
    return parts.join(' ')
  }

  const menuOpts = {
    message,
    items: tickets,
    format: formatStyled,
    formatPlain: (t: Ticket) => formatTicketPlain(t, fmtOpts),
    getValue: (t: Ticket) => t.id,
    pageSize,
    groupBy: groupByPriority ? (t: Ticket) => t.priority || 'None' : undefined,
    groupOrder: groupByPriority ? PRIORITY_ORDER : undefined,
    jsonMode,
    getCommand,
    validate,
    emptyMessage,
    log: logFn,
  }

  if (mode === 'checkbox') {
    return listMenu({ ...menuOpts, mode: 'checkbox' })
  }
  return listMenu(menuOpts)
}
