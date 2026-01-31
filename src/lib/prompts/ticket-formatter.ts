/**
 * Unified Ticket Formatter
 *
 * Provides consistent ticket display formatting across all CLI commands.
 * Used by list menus, ticket lists, and any other ticket display contexts.
 *
 * Format patterns:
 * - Compact: [P0] TKT-001 - Title (status)
 * - Standard: [P0] TKT-001 - Title [status] (assignee: agent-name)
 * - Detailed: Includes description preview and subtask count
 *
 * @example
 * ```typescript
 * import { formatTicketChoice, formatTicketLine, PRIORITY_ORDER } from './ticket-formatter'
 *
 * // For list menu choices
 * const choice = formatTicketChoice(ticket)
 * // → "[P0] TKT-001 - Add user authentication [In Progress] (assignee: dorsey)"
 *
 * // For table/list output
 * const line = formatTicketLine(ticket, { showDescription: true })
 * ```
 */

import { styles, formatPriority, formatCategory, getColumnStyle } from '../styles.js'
import type { Ticket } from '../pmo/types.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Options for ticket formatting
 */
export interface TicketFormatOptions {
  /** Show priority badge [P0], [P1], etc. */
  showPriority?: boolean
  /** Show status/column badge [In Progress] */
  showStatus?: boolean
  /** Show category badge [feature] */
  showCategory?: boolean
  /** Show assignee (assignee: name) */
  showAssignee?: boolean
  /** Show project name [project-name] (for cross-project views) */
  showProject?: boolean
  /** Maximum title length before truncation */
  maxTitleLength?: number
  /** Show description preview */
  showDescription?: boolean
  /** Maximum description length before truncation */
  maxDescriptionLength?: number
  /** Show subtask progress (2/5) */
  showSubtasks?: boolean
  /** Use color styling (default: true) */
  useColors?: boolean
}

/**
 * Pre-built format presets for common use cases
 */
export type TicketFormatPreset = 'compact' | 'standard' | 'detailed' | 'menu' | 'json'

// =============================================================================
// Constants
// =============================================================================

/**
 * Priority order for grouping/sorting (P0 highest, None lowest)
 */
export const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3', 'None'] as const

/**
 * Default format options
 */
const DEFAULT_OPTIONS: TicketFormatOptions = {
  showPriority: true,
  showStatus: true,
  showCategory: false,
  showAssignee: false,
  showProject: false,
  maxTitleLength: 60,
  showDescription: false,
  maxDescriptionLength: 55,
  showSubtasks: false,
  useColors: true,
}

/**
 * Format presets
 */
const PRESETS: Record<TicketFormatPreset, Partial<TicketFormatOptions>> = {
  compact: {
    showPriority: true,
    showStatus: true,
    showCategory: false,
    showAssignee: false,
    maxTitleLength: 50,
  },
  standard: {
    showPriority: true,
    showStatus: true,
    showCategory: true,
    showAssignee: true,
    maxTitleLength: 60,
  },
  detailed: {
    showPriority: true,
    showStatus: true,
    showCategory: true,
    showAssignee: true,
    showDescription: true,
    showSubtasks: true,
    maxTitleLength: 60,
    maxDescriptionLength: 80,
  },
  menu: {
    showPriority: true,
    showStatus: true,
    showCategory: false,
    showAssignee: true,
    showProject: false,
    maxTitleLength: 50,
  },
  json: {
    showPriority: true,
    showStatus: true,
    showCategory: true,
    showAssignee: true,
    showProject: true,
    useColors: false,
  },
}

// =============================================================================
// Core Formatters
// =============================================================================

/**
 * Truncate a string with ellipsis if it exceeds max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format ticket priority for display
 *
 * @returns Formatted priority string like "[P0]" with appropriate color
 */
export function formatTicketPriority(priority?: string, useColors = true): string {
  if (!priority) return ''
  if (useColors) {
    return formatPriority(priority)
  }
  return `[${priority}]`
}

/**
 * Format ticket status for display
 *
 * @returns Formatted status string like "[In Progress]" with column color
 */
export function formatTicketStatus(status?: string, useColors = true): string {
  if (!status) return ''
  if (useColors) {
    const columnStyle = getColumnStyle(status)
    return columnStyle(`[${status}]`)
  }
  return `[${status}]`
}

/**
 * Format ticket ID with styling
 */
export function formatTicketId(id: string, useColors = true): string {
  if (useColors) {
    return styles.code(id)
  }
  return id
}

/**
 * Format assignee information
 */
export function formatAssignee(assignee?: string, useColors = true): string {
  if (!assignee) return useColors ? styles.muted('(unassigned)') : '(unassigned)'
  return useColors ? styles.muted(`(assignee: ${assignee})`) : `(assignee: ${assignee})`
}

/**
 * Format project badge
 */
export function formatProjectBadge(projectName?: string, useColors = true): string {
  if (!projectName) return ''
  if (useColors) {
    return styles.info(`[${projectName}]`)
  }
  return `[${projectName}]`
}

// =============================================================================
// High-Level Formatters
// =============================================================================

/**
 * Format a ticket for display in a list menu choice.
 *
 * @param ticket - The ticket to format
 * @param options - Format options or preset name
 * @returns Formatted string for menu display
 *
 * @example
 * ```typescript
 * formatTicketChoice(ticket)
 * // → "[P0] TKT-001 - Add user auth [In Progress] (assignee: dorsey)"
 *
 * formatTicketChoice(ticket, 'compact')
 * // → "[P0] TKT-001 - Add user auth [In Progress]"
 *
 * formatTicketChoice(ticket, { showProject: true })
 * // → "[P0] TKT-001 - Add user auth [In Progress] [my-project]"
 * ```
 */
export function formatTicketChoice(
  ticket: Ticket,
  options: TicketFormatOptions | TicketFormatPreset = 'menu'
): string {
  const opts: TicketFormatOptions = {
    ...DEFAULT_OPTIONS,
    ...(typeof options === 'string' ? PRESETS[options] : options),
  }

  const parts: string[] = []

  // Priority badge
  if (opts.showPriority) {
    const priority = formatTicketPriority(ticket.priority, opts.useColors)
    if (priority) parts.push(priority)
  }

  // Ticket ID
  parts.push(formatTicketId(ticket.id, opts.useColors))

  // Title (with separator)
  const title = truncate(ticket.title, opts.maxTitleLength || 60)
  parts.push(`- ${title}`)

  // Status badge
  if (opts.showStatus && ticket.statusName) {
    parts.push(formatTicketStatus(ticket.statusName, opts.useColors))
  }

  // Category badge
  if (opts.showCategory && ticket.category) {
    parts.push(opts.useColors ? formatCategory(ticket.category) : `[${ticket.category}]`)
  }

  // Project badge
  if (opts.showProject && ticket.projectName) {
    parts.push(formatProjectBadge(ticket.projectName, opts.useColors))
  }

  // Assignee
  if (opts.showAssignee) {
    parts.push(formatAssignee(ticket.assignee, opts.useColors))
  }

  return parts.join(' ')
}

/**
 * Format a ticket for table/list output (multi-line support).
 *
 * @param ticket - The ticket to format
 * @param options - Format options or preset name
 * @returns Object with main line and optional additional lines
 */
export function formatTicketLine(
  ticket: Ticket,
  options: TicketFormatOptions | TicketFormatPreset = 'standard'
): { main: string; description?: string; subtasks?: string } {
  const opts: TicketFormatOptions = {
    ...DEFAULT_OPTIONS,
    ...(typeof options === 'string' ? PRESETS[options] : options),
  }

  // Main line
  const main = formatTicketChoice(ticket, opts)

  const result: { main: string; description?: string; subtasks?: string } = { main }

  // Description preview
  if (opts.showDescription && ticket.description) {
    const firstLine = ticket.description.split('\n')[0]
    const preview = truncate(firstLine, opts.maxDescriptionLength || 55)
    result.description = opts.useColors ? styles.muted(`   ${preview}`) : `   ${preview}`
  }

  // Subtask progress
  if (opts.showSubtasks && ticket.subtasks && ticket.subtasks.length > 0) {
    const done = ticket.subtasks.filter((s) => s.done).length
    const total = ticket.subtasks.length
    const progress = `Subtasks: ${done}/${total}`
    result.subtasks = opts.useColors ? styles.muted(`   ${progress}`) : `   ${progress}`
  }

  return result
}

/**
 * Format a ticket for JSON output (no colors, all fields).
 *
 * @param ticket - The ticket to format
 * @returns Plain text formatted string
 */
export function formatTicketForJson(ticket: Ticket): string {
  return formatTicketChoice(ticket, 'json')
}

// =============================================================================
// Grouping Helpers
// =============================================================================

/**
 * Get the priority group key for a ticket.
 * Returns 'None' for tickets without priority.
 */
export function getTicketPriorityGroup(ticket: Ticket): string {
  return ticket.priority || 'None'
}

/**
 * Get the status group key for a ticket.
 * Returns 'No Status' for tickets without status.
 */
export function getTicketStatusGroup(ticket: Ticket): string {
  return ticket.statusName || 'No Status'
}

/**
 * Get the project group key for a ticket.
 */
export function getTicketProjectGroup(ticket: Ticket): string {
  return ticket.projectName || ticket.projectId || 'Unknown'
}

/**
 * Sort tickets by priority (P0 first, None last)
 */
export function sortTicketsByPriority(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const aIndex = PRIORITY_ORDER.indexOf((a.priority || 'None') as typeof PRIORITY_ORDER[number])
    const bIndex = PRIORITY_ORDER.indexOf((b.priority || 'None') as typeof PRIORITY_ORDER[number])
    return aIndex - bIndex
  })
}

/**
 * Sort tickets by position (board order)
 */
export function sortTicketsByPosition(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => (a.position || 0) - (b.position || 0))
}

// =============================================================================
// Command Builder
// =============================================================================

/**
 * Build a CLI command string for a ticket (for JSON mode).
 *
 * @param ticket - The ticket
 * @param commandTemplate - Command template with {id} placeholder
 * @returns Full command string
 *
 * @example
 * ```typescript
 * buildTicketCommand(ticket, 'prlt work start {id} --json')
 * // → "prlt work start TKT-001 --json"
 * ```
 */
export function buildTicketCommand(ticket: Ticket, commandTemplate: string): string {
  return commandTemplate.replaceAll('{id}', ticket.id)
}
