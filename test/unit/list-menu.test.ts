/**
 * Unit tests for the unified list menu component
 *
 * These tests verify the internal helper functions and type correctness.
 * Integration tests for the full interactive flow are in the e2e tests.
 */

import { expect } from 'chai'

// We test the internal logic by examining the exported types and functions
// Full interactive testing requires e2e tests with mocked stdin

describe('listMenu module', () => {
  describe('type exports', () => {
    it('should export listMenu function', async () => {
      const { listMenu } = await import('../../src/lib/prompts/list-menu.js')
      expect(typeof listMenu).to.equal('function')
    })

    it('should export listMenuMulti function', async () => {
      const { listMenuMulti } = await import('../../src/lib/prompts/list-menu.js')
      expect(typeof listMenuMulti).to.equal('function')
    })
  })

  describe('empty state handling', () => {
    it('listMenu should return null for empty choices without prompting', async () => {
      const { listMenu } = await import('../../src/lib/prompts/list-menu.js')

      const result = await listMenu({
        message: 'Select:',
        choices: [],
      })

      expect(result).to.be.null
    })

    it('listMenuMulti should return null for empty choices without prompting', async () => {
      const { listMenuMulti } = await import('../../src/lib/prompts/list-menu.js')

      const result = await listMenuMulti({
        message: 'Select:',
        choices: [],
      })

      expect(result).to.be.null
    })
  })

  describe('index exports', () => {
    it('should export all list menu functions from index', async () => {
      const exports = await import('../../src/lib/prompts/index.js')

      expect(typeof exports.listMenu).to.equal('function')
      expect(typeof exports.listMenuMulti).to.equal('function')
    })

    it('should export all ticket formatters from index', async () => {
      const exports = await import('../../src/lib/prompts/index.js')

      expect(typeof exports.formatTicketChoice).to.equal('function')
      expect(typeof exports.formatTicketLine).to.equal('function')
      expect(typeof exports.formatTicketForJson).to.equal('function')
      expect(typeof exports.formatTicketPriority).to.equal('function')
      expect(typeof exports.formatTicketStatus).to.equal('function')
      expect(typeof exports.formatTicketId).to.equal('function')
      expect(typeof exports.formatAssignee).to.equal('function')
      expect(typeof exports.formatProjectBadge).to.equal('function')
    })

    it('should export grouping helpers from index', async () => {
      const exports = await import('../../src/lib/prompts/index.js')

      expect(typeof exports.getTicketPriorityGroup).to.equal('function')
      expect(typeof exports.getTicketStatusGroup).to.equal('function')
      expect(typeof exports.getTicketProjectGroup).to.equal('function')
      expect(typeof exports.sortTicketsByPriority).to.equal('function')
      expect(typeof exports.sortTicketsByPosition).to.equal('function')
    })

    it('should export command builder from index', async () => {
      const exports = await import('../../src/lib/prompts/index.js')

      expect(typeof exports.buildTicketCommand).to.equal('function')
    })

    it('should export PRIORITY_ORDER constant from index', async () => {
      const exports = await import('../../src/lib/prompts/index.js')

      expect(exports.PRIORITY_ORDER).to.deep.equal(['P0', 'P1', 'P2', 'P3', 'None'])
    })
  })

  describe('async choice loading', () => {
    it('should handle async choices that return items', async () => {
      const { listMenu } = await import('../../src/lib/prompts/list-menu.js')

      // Note: We can't test the full interactive flow, but we can test
      // that async choices that return empty arrays work correctly
      const asyncChoices = async () => []

      const result = await listMenu({
        message: 'Select:',
        choices: asyncChoices,
      })

      expect(result).to.be.null
    })

    it('should propagate errors from async loading', async () => {
      const { listMenu } = await import('../../src/lib/prompts/list-menu.js')

      const asyncChoices = async () => {
        throw new Error('Load failed')
      }

      try {
        await listMenu({
          message: 'Select:',
          choices: asyncChoices,
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error).message).to.equal('Load failed')
      }
    })
  })

  describe('JSON mode error output', () => {
    // These tests verify that the functions can detect JSON mode
    // but don't actually test the JSON output (that would require e2e tests)
    it('listMenu should accept jsonMode option', async () => {
      const { listMenu } = await import('../../src/lib/prompts/list-menu.js')

      // When there are no items, it outputs an error in JSON mode
      // We can't easily capture that output, but we can verify the function accepts the option
      const result = await listMenu({
        message: 'Select:',
        choices: [],
        emptyMessage: 'No items',
        jsonMode: { flags: { json: false }, commandName: 'test' }, // json: false to avoid exit
      })

      expect(result).to.be.null
    })
  })
})
