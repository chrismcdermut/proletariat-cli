/**
 * Unified Prompts Library
 *
 * Provides consistent interactive prompt components for the CLI.
 *
 * Components:
 * - listMenu / listMenuMulti: Single and multi-select menus with grouping, pagination, and JSON mode
 * - Ticket formatters: Consistent ticket display across all commands
 *
 * @example
 * ```typescript
 * import { listMenu, formatTicketChoice, PRIORITY_ORDER } from '../lib/prompts'
 *
 * // Select a ticket with priority grouping
 * const ticket = await listMenu({
 *   message: 'Select ticket:',
 *   choices: tickets,
 *   format: formatTicketChoice,
 *   getValue: (t) => t.id,
 *   groupBy: (t) => t.priority || 'None',
 *   groupOrder: PRIORITY_ORDER,
 *   pageSize: 15,
 *   jsonMode: { flags, commandName: 'work start' },
 * })
 * ```
 */

// List menu components
export {
  listMenu,
  listMenuMulti,
  type ListMenuOptions,
  type ListMenuMultiOptions,
  type ListMenuBaseOptions,
  type ListMenuJsonMode,
  type ListMenuResult,
} from './list-menu.js'

// Ticket formatters
export {
  // Core formatters
  formatTicketChoice,
  formatTicketLine,
  formatTicketForJson,
  formatTicketPriority,
  formatTicketStatus,
  formatTicketId,
  formatAssignee,
  formatProjectBadge,
  // Grouping helpers
  getTicketPriorityGroup,
  getTicketStatusGroup,
  getTicketProjectGroup,
  sortTicketsByPriority,
  sortTicketsByPosition,
  // Command builder
  buildTicketCommand,
  // Types
  type TicketFormatOptions,
  type TicketFormatPreset,
  // Constants
  PRIORITY_ORDER,
} from './ticket-formatter.js'
