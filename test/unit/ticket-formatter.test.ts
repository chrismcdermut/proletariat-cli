/**
 * Unit tests for the unified ticket formatter
 */

import { expect } from 'chai'
import {
  formatTicketChoice,
  formatTicketLine,
  formatTicketForJson,
  formatTicketPriority,
  formatTicketStatus,
  formatTicketId,
  formatAssignee,
  formatProjectBadge,
  getTicketPriorityGroup,
  getTicketStatusGroup,
  getTicketProjectGroup,
  sortTicketsByPriority,
  sortTicketsByPosition,
  buildTicketCommand,
  PRIORITY_ORDER,
} from '../../src/lib/prompts/ticket-formatter.js'
import type { Ticket } from '../../src/lib/pmo/types.js'

// Helper to create a mock ticket
function createMockTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'TKT-001',
    title: 'Test ticket title',
    description: 'Test description',
    priority: 'P0',
    category: 'feature',
    projectId: 'project-1',
    projectName: 'Test Project',
    statusId: 'status-1',
    statusName: 'In Progress',
    statusCategory: 'started',
    assignee: 'dorsey',
    subtasks: [],
    labels: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('formatTicketChoice', () => {
  describe('with default options', () => {
    it('should format ticket with priority, id, title, and status', () => {
      const ticket = createMockTicket()
      const result = formatTicketChoice(ticket)

      // Should contain all the key parts (colors stripped for testing)
      expect(result).to.include('[P0]')
      expect(result).to.include('TKT-001')
      expect(result).to.include('Test ticket title')
      expect(result).to.include('[In Progress]')
    })

    it('should include assignee in menu preset', () => {
      const ticket = createMockTicket({ assignee: 'dorsey' })
      const result = formatTicketChoice(ticket, 'menu')

      expect(result).to.include('assignee: dorsey')
    })

    it('should show unassigned for missing assignee in menu preset', () => {
      const ticket = createMockTicket({ assignee: undefined })
      const result = formatTicketChoice(ticket, 'menu')

      expect(result).to.include('unassigned')
    })
  })

  describe('with presets', () => {
    it('compact preset should not show assignee', () => {
      const ticket = createMockTicket({ assignee: 'dorsey' })
      const result = formatTicketChoice(ticket, 'compact')

      expect(result).to.not.include('assignee')
      expect(result).to.include('[P0]')
      expect(result).to.include('TKT-001')
    })

    it('standard preset should show category', () => {
      const ticket = createMockTicket({ category: 'feature' })
      const result = formatTicketChoice(ticket, 'standard')

      expect(result).to.include('[feature]')
    })

    it('detailed preset should show all fields', () => {
      const ticket = createMockTicket()
      const result = formatTicketChoice(ticket, 'detailed')

      expect(result).to.include('[P0]')
      expect(result).to.include('TKT-001')
      expect(result).to.include('[In Progress]')
      expect(result).to.include('[feature]')
      expect(result).to.include('assignee: dorsey')
    })

    it('json preset should not use colors', () => {
      const ticket = createMockTicket()
      const result = formatTicketChoice(ticket, 'json')

      // The result should be plain text without ANSI color codes
      // Use a character code check instead of regex to avoid escape lint warnings
      expect(result.includes(String.fromCharCode(27))).to.be.false
    })
  })

  describe('with custom options', () => {
    it('should show project when showProject is true', () => {
      const ticket = createMockTicket({ projectName: 'My Project' })
      const result = formatTicketChoice(ticket, { showProject: true })

      expect(result).to.include('[My Project]')
    })

    it('should truncate long titles', () => {
      const ticket = createMockTicket({
        title: 'This is a very long title that should definitely be truncated at some point',
      })
      const result = formatTicketChoice(ticket, { maxTitleLength: 30 })

      expect(result).to.include('...')
      expect(result.length).to.be.lessThan(
        formatTicketChoice(ticket, { maxTitleLength: 100 }).length
      )
    })

    it('should hide priority when showPriority is false', () => {
      const ticket = createMockTicket({ priority: 'P0' })
      const result = formatTicketChoice(ticket, { showPriority: false })

      expect(result).to.not.include('[P0]')
    })

    it('should hide status when showStatus is false', () => {
      const ticket = createMockTicket({ statusName: 'In Progress' })
      const result = formatTicketChoice(ticket, { showStatus: false })

      expect(result).to.not.include('[In Progress]')
    })
  })

  describe('edge cases', () => {
    it('should handle missing priority', () => {
      const ticket = createMockTicket({ priority: undefined })
      const result = formatTicketChoice(ticket)

      expect(result).to.not.include('[undefined]')
      expect(result).to.include('TKT-001')
    })

    it('should handle missing status', () => {
      const ticket = createMockTicket({ statusName: undefined })
      const result = formatTicketChoice(ticket)

      expect(result).to.include('TKT-001')
    })
  })
})

describe('formatTicketLine', () => {
  it('should return main line for standard format', () => {
    const ticket = createMockTicket()
    const result = formatTicketLine(ticket)

    expect(result.main).to.exist
    expect(result.main).to.include('TKT-001')
  })

  it('should include description when showDescription is true', () => {
    const ticket = createMockTicket({
      description: 'This is the description\nSecond line',
    })
    const result = formatTicketLine(ticket, 'detailed')

    expect(result.description).to.exist
    expect(result.description).to.include('This is the description')
    expect(result.description).to.not.include('Second line')
  })

  it('should truncate long descriptions', () => {
    const ticket = createMockTicket({
      description: 'This is a very long description that should be truncated at a reasonable length for display purposes',
    })
    const result = formatTicketLine(ticket, { showDescription: true, maxDescriptionLength: 30 })

    expect(result.description).to.include('...')
  })

  it('should include subtask progress when showSubtasks is true', () => {
    const ticket = createMockTicket({
      subtasks: [
        { id: '1', title: 'Task 1', done: true },
        { id: '2', title: 'Task 2', done: false },
        { id: '3', title: 'Task 3', done: true },
      ],
    })
    const result = formatTicketLine(ticket, 'detailed')

    expect(result.subtasks).to.exist
    expect(result.subtasks).to.include('2/3')
  })
})

describe('formatTicketForJson', () => {
  it('should format ticket without colors', () => {
    const ticket = createMockTicket()
    const result = formatTicketForJson(ticket)

    // Should not contain ANSI color codes
    // Use a character code check instead of regex to avoid escape lint warnings
    expect(result.includes(String.fromCharCode(27))).to.be.false
    expect(result).to.include('TKT-001')
    expect(result).to.include('[P0]')
  })

  it('should include all fields', () => {
    const ticket = createMockTicket()
    const result = formatTicketForJson(ticket)

    expect(result).to.include('TKT-001')
    expect(result).to.include('[P0]')
    expect(result).to.include('[In Progress]')
    expect(result).to.include('[feature]')
    expect(result).to.include('[Test Project]')
  })
})

describe('individual formatters', () => {
  describe('formatTicketPriority', () => {
    it('should format P0 priority', () => {
      const result = formatTicketPriority('P0')
      expect(result).to.include('[P0]')
    })

    it('should return empty string for undefined', () => {
      const result = formatTicketPriority()
      expect(result).to.equal('')
    })

    it('should format without colors when useColors is false', () => {
      const result = formatTicketPriority('P0', false)
      expect(result).to.equal('[P0]')
    })
  })

  describe('formatTicketStatus', () => {
    it('should format status with brackets', () => {
      const result = formatTicketStatus('In Progress')
      expect(result).to.include('[In Progress]')
    })

    it('should return empty string for undefined', () => {
      const result = formatTicketStatus()
      expect(result).to.equal('')
    })
  })

  describe('formatTicketId', () => {
    it('should format ticket ID', () => {
      const result = formatTicketId('TKT-001')
      expect(result).to.include('TKT-001')
    })
  })

  describe('formatAssignee', () => {
    it('should format assignee name', () => {
      const result = formatAssignee('dorsey')
      expect(result).to.include('assignee: dorsey')
    })

    it('should show unassigned for undefined', () => {
      const result = formatAssignee()
      expect(result).to.include('unassigned')
    })
  })

  describe('formatProjectBadge', () => {
    it('should format project name', () => {
      const result = formatProjectBadge('My Project')
      expect(result).to.include('[My Project]')
    })

    it('should return empty string for undefined', () => {
      const result = formatProjectBadge()
      expect(result).to.equal('')
    })
  })
})

describe('grouping helpers', () => {
  describe('getTicketPriorityGroup', () => {
    it('should return priority for tickets with priority', () => {
      const ticket = createMockTicket({ priority: 'P1' })
      expect(getTicketPriorityGroup(ticket)).to.equal('P1')
    })

    it('should return None for tickets without priority', () => {
      const ticket = createMockTicket({ priority: undefined })
      expect(getTicketPriorityGroup(ticket)).to.equal('None')
    })
  })

  describe('getTicketStatusGroup', () => {
    it('should return status name for tickets with status', () => {
      const ticket = createMockTicket({ statusName: 'In Review' })
      expect(getTicketStatusGroup(ticket)).to.equal('In Review')
    })

    it('should return No Status for tickets without status', () => {
      const ticket = createMockTicket({ statusName: undefined })
      expect(getTicketStatusGroup(ticket)).to.equal('No Status')
    })
  })

  describe('getTicketProjectGroup', () => {
    it('should return project name if available', () => {
      const ticket = createMockTicket({ projectName: 'My Project' })
      expect(getTicketProjectGroup(ticket)).to.equal('My Project')
    })

    it('should fall back to project ID', () => {
      const ticket = createMockTicket({ projectName: undefined, projectId: 'proj-123' })
      expect(getTicketProjectGroup(ticket)).to.equal('proj-123')
    })

    it('should return Unknown if neither available', () => {
      const ticket = createMockTicket({ projectName: undefined, projectId: undefined })
      expect(getTicketProjectGroup(ticket)).to.equal('Unknown')
    })
  })
})

describe('sorting helpers', () => {
  describe('sortTicketsByPriority', () => {
    it('should sort tickets by priority (P0 first)', () => {
      const tickets = [
        createMockTicket({ id: '1', priority: 'P2' }),
        createMockTicket({ id: '2', priority: 'P0' }),
        createMockTicket({ id: '3', priority: 'P1' }),
        createMockTicket({ id: '4', priority: undefined }),
      ]

      const sorted = sortTicketsByPriority(tickets)

      expect(sorted[0].id).to.equal('2') // P0
      expect(sorted[1].id).to.equal('3') // P1
      expect(sorted[2].id).to.equal('1') // P2
      expect(sorted[3].id).to.equal('4') // None
    })

    it('should not mutate original array', () => {
      const tickets = [
        createMockTicket({ id: '1', priority: 'P2' }),
        createMockTicket({ id: '2', priority: 'P0' }),
      ]
      const original = [...tickets]

      sortTicketsByPriority(tickets)

      expect(tickets).to.deep.equal(original)
    })
  })

  describe('sortTicketsByPosition', () => {
    it('should sort tickets by position', () => {
      const tickets = [
        createMockTicket({ id: '1', position: 3 }),
        createMockTicket({ id: '2', position: 1 }),
        createMockTicket({ id: '3', position: 2 }),
      ]

      const sorted = sortTicketsByPosition(tickets)

      expect(sorted[0].id).to.equal('2')
      expect(sorted[1].id).to.equal('3')
      expect(sorted[2].id).to.equal('1')
    })

    it('should handle missing positions', () => {
      const tickets = [
        createMockTicket({ id: '1', position: 2 }),
        createMockTicket({ id: '2', position: undefined }),
        createMockTicket({ id: '3', position: 1 }),
      ]

      const sorted = sortTicketsByPosition(tickets)

      expect(sorted[0].id).to.equal('2') // undefined becomes 0
      expect(sorted[1].id).to.equal('3') // 1
      expect(sorted[2].id).to.equal('1') // 2
    })
  })
})

describe('buildTicketCommand', () => {
  it('should replace {id} placeholder with ticket ID', () => {
    const ticket = createMockTicket({ id: 'TKT-123' })
    const result = buildTicketCommand(ticket, 'prlt work start {id} --json')

    expect(result).to.equal('prlt work start TKT-123 --json')
  })

  it('should handle multiple placeholders', () => {
    const ticket = createMockTicket({ id: 'TKT-456' })
    const result = buildTicketCommand(ticket, 'prlt ticket view {id} && prlt work start {id}')

    expect(result).to.equal('prlt ticket view TKT-456 && prlt work start TKT-456')
  })
})

describe('PRIORITY_ORDER', () => {
  it('should contain all priorities in correct order', () => {
    expect(PRIORITY_ORDER).to.deep.equal(['P0', 'P1', 'P2', 'P3', 'None'])
  })
})
