import { expect } from 'chai';
import {
  formatTicketPlain,
  groupItems,
  listMenu,
  ticketListMenu,
} from '../../src/lib/prompts/list-menu.js';
import type { Ticket } from '../../src/lib/pmo/types.js';

// ── Test fixture helper ──────────────────────────────────────────

/**
 * Build a minimal Ticket for testing.  All required fields are filled with
 * sensible defaults; pass overrides to set the fields you care about.
 */
function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'TKT-001',
    title: 'Test ticket',
    statusId: 'backlog',
    subtasks: [],
    labels: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Ticket;
}

// ── formatTicketPlain ────────────────────────────────────────────

describe('formatTicketPlain', () => {
  it('formats a fully populated ticket', () => {
    const ticket = makeTicket({
      id: 'TKT-042',
      title: 'Fix login bug',
      priority: 'P1',
      statusName: 'In Progress',
    });
    expect(formatTicketPlain(ticket)).to.equal(
      '[P1] TKT-042 - Fix login bug [In Progress]'
    );
  });

  it('shows [None] when priority is undefined', () => {
    const ticket = makeTicket({ id: 'TKT-001', title: 'No priority' });
    expect(formatTicketPlain(ticket)).to.match(/^\[None\]/);
  });

  it('omits status badge when statusName is missing', () => {
    const ticket = makeTicket({ id: 'TKT-001', title: 'No status', priority: 'P2' });
    expect(formatTicketPlain(ticket)).to.equal('[P2] TKT-001 - No status');
  });

  it('omits status badge when showStatus is false', () => {
    const ticket = makeTicket({
      id: 'TKT-001',
      title: 'Has status',
      priority: 'P0',
      statusName: 'Done',
    });
    const result = formatTicketPlain(ticket, { showStatus: false });
    expect(result).to.not.include('[Done]');
    expect(result).to.equal('[P0] TKT-001 - Has status');
  });

  it('truncates titles that exceed titleLength', () => {
    const longTitle = 'A'.repeat(60);
    const ticket = makeTicket({ title: longTitle, priority: 'P0' });
    const result = formatTicketPlain(ticket, { titleLength: 20 });
    // Truncated to 19 chars + …
    expect(result).to.include('…');
    expect(result).to.not.include(longTitle);
    // Verify the truncated portion is exactly titleLength - 1 chars + …
    const titlePart = result.split(' - ')[1].split(' [')[0];
    expect(titlePart.length).to.equal(20); // 19 A's + …
  });

  it('does not truncate titles within titleLength', () => {
    const ticket = makeTicket({ title: 'Short title', priority: 'P0' });
    const result = formatTicketPlain(ticket, { titleLength: 50 });
    expect(result).to.include('Short title');
    expect(result).to.not.include('…');
  });

  it('shows assignee when showAssignee is true', () => {
    const ticket = makeTicket({ priority: 'P0', assignee: 'alice' });
    const result = formatTicketPlain(ticket, { showAssignee: true });
    expect(result).to.include('(alice)');
  });

  it('shows (unassigned) when assignee is missing and showAssignee is true', () => {
    const ticket = makeTicket({ priority: 'P0' });
    const result = formatTicketPlain(ticket, { showAssignee: true });
    expect(result).to.include('(unassigned)');
  });

  it('omits assignee info when showAssignee is false (default)', () => {
    const ticket = makeTicket({ priority: 'P1', assignee: 'bob' });
    const result = formatTicketPlain(ticket);
    expect(result).to.not.include('bob');
    expect(result).to.not.include('unassigned');
  });

  it('shows project badge when showProject is true', () => {
    const ticket = makeTicket({
      priority: 'P0',
      projectName: 'mobile-app',
    });
    const result = formatTicketPlain(ticket, { showProject: true });
    expect(result).to.include('[mobile-app]');
  });

  it('omits project badge when showProject is false (default)', () => {
    const ticket = makeTicket({ priority: 'P0', projectName: 'mobile-app' });
    const result = formatTicketPlain(ticket);
    expect(result).to.not.include('[mobile-app]');
  });

  it('omits project badge when projectName is missing even if showProject is true', () => {
    const ticket = makeTicket({ priority: 'P0' });
    const result = formatTicketPlain(ticket, { showProject: true });
    // No project badge, but also no empty brackets
    expect(result).to.not.include('[]');
  });

  it('combines all badges in correct order', () => {
    const ticket = makeTicket({
      id: 'TKT-099',
      title: 'Full display',
      priority: 'P2',
      statusName: 'Review',
      projectName: 'backend',
      assignee: 'charlie',
    });
    const result = formatTicketPlain(ticket, {
      showStatus: true,
      showProject: true,
      showAssignee: true,
    });
    expect(result).to.equal(
      '[P2] TKT-099 - Full display [Review] [backend] (charlie)'
    );
  });
});

// ── groupItems ───────────────────────────────────────────────────

describe('groupItems', () => {
  it('groups items by key function', () => {
    const items = [
      { name: 'a', group: 'X' },
      { name: 'b', group: 'Y' },
      { name: 'c', group: 'X' },
    ];
    const result = groupItems(items, (i) => i.group);
    expect(result).to.have.lengthOf(2);
    expect(result[0][0]).to.equal('X');
    expect(result[0][1]).to.have.lengthOf(2);
    expect(result[1][0]).to.equal('Y');
    expect(result[1][1]).to.have.lengthOf(1);
  });

  it('respects prescribed order', () => {
    const items = [
      { name: 'a', group: 'C' },
      { name: 'b', group: 'A' },
      { name: 'c', group: 'B' },
    ];
    const result = groupItems(items, (i) => i.group, ['B', 'A', 'C']);
    expect(result.map(([k]) => k)).to.deep.equal(['B', 'A', 'C']);
  });

  it('puts unordered groups after ordered ones', () => {
    const items = [
      { name: 'a', group: 'Z' },
      { name: 'b', group: 'A' },
    ];
    const result = groupItems(items, (i) => i.group, ['A']);
    expect(result[0][0]).to.equal('A');
    expect(result[1][0]).to.equal('Z');
  });

  it('omits empty groups from result', () => {
    const items = [{ name: 'a', group: 'X' }];
    // Order specifies Y but no items have group Y
    const result = groupItems(items, (i) => i.group, ['X', 'Y']);
    expect(result).to.have.lengthOf(1);
    expect(result[0][0]).to.equal('X');
  });

  it('returns empty array for empty input', () => {
    const result = groupItems([] as Array<{ group: string }>, (i) => i.group);
    expect(result).to.have.lengthOf(0);
  });

  it('preserves insertion order when no order is specified', () => {
    const items = [
      { name: 'first', group: 'B' },
      { name: 'second', group: 'A' },
      { name: 'third', group: 'C' },
    ];
    const result = groupItems(items, (i) => i.group);
    // Without an order array, groups appear in first-seen order
    expect(result.map(([k]) => k)).to.deep.equal(['B', 'A', 'C']);
  });
});

// ── Priority grouping (via groupItems with PRIORITY_ORDER) ──────

describe('ticket priority grouping', () => {
  it('orders groups as P0, P1, P2, P3, None', () => {
    const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3', 'None'];
    const tickets = [
      makeTicket({ id: 'TKT-001', priority: 'P3' }),
      makeTicket({ id: 'TKT-002', priority: 'P0' }),
      makeTicket({ id: 'TKT-003', priority: 'P1' }),
      makeTicket({ id: 'TKT-004' }), // no priority → None
      makeTicket({ id: 'TKT-005', priority: 'P2' }),
    ];

    const groups = groupItems(
      tickets,
      (t) => t.priority || 'None',
      PRIORITY_ORDER
    );

    expect(groups.map(([k]) => k)).to.deep.equal(['P0', 'P1', 'P2', 'P3', 'None']);
    expect(groups[0][1][0].id).to.equal('TKT-002'); // P0
    expect(groups[1][1][0].id).to.equal('TKT-003'); // P1
    expect(groups[2][1][0].id).to.equal('TKT-005'); // P2
    expect(groups[3][1][0].id).to.equal('TKT-001'); // P3
    expect(groups[4][1][0].id).to.equal('TKT-004'); // None
  });

  it('skips empty priority levels', () => {
    const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3', 'None'];
    const tickets = [
      makeTicket({ id: 'TKT-001', priority: 'P0' }),
      makeTicket({ id: 'TKT-002', priority: 'P3' }),
    ];

    const groups = groupItems(
      tickets,
      (t) => t.priority || 'None',
      PRIORITY_ORDER
    );

    // Only P0 and P3 have tickets
    expect(groups.map(([k]) => k)).to.deep.equal(['P0', 'P3']);
  });
});

// ── listMenu empty state ─────────────────────────────────────────

describe('listMenu empty state', () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  });

  it('returns null for list mode with empty items', async () => {
    const result = await listMenu({
      items: [] as string[],
      format: (i) => i,
      getValue: (i) => i,
      message: 'Pick:',
      log: () => {}, // suppress output
    });
    expect(result).to.be.null;
  });

  it('returns empty array for checkbox mode with empty items', async () => {
    const result = await listMenu({
      items: [] as string[],
      format: (i) => i,
      getValue: (i) => i,
      message: 'Pick:',
      mode: 'checkbox',
      log: () => {},
    });
    expect(result).to.deep.equal([]);
  });

  it('calls log with emptyMessage when provided', async () => {
    const logged: string[] = [];
    await listMenu({
      items: [] as string[],
      format: (i) => i,
      getValue: (i) => i,
      message: 'Pick:',
      emptyMessage: 'Nothing here',
      log: (msg) => logged.push(msg),
    });
    expect(logged).to.have.lengthOf(1);
    expect(logged[0]).to.equal('Nothing here');
  });

  it('does not call log when emptyMessage is not provided', async () => {
    const logged: string[] = [];
    await listMenu({
      items: [] as string[],
      format: (i) => i,
      getValue: (i) => i,
      message: 'Pick:',
      log: (msg) => logged.push(msg),
    });
    expect(logged).to.have.lengthOf(0);
  });
});

// ── ticketListMenu empty state ───────────────────────────────────

describe('ticketListMenu empty state', () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  });

  it('returns null for list mode with empty tickets', async () => {
    const result = await ticketListMenu({
      tickets: [],
      message: 'Select:',
      log: () => {},
    });
    expect(result).to.be.null;
  });

  it('returns empty array for checkbox mode with empty tickets', async () => {
    const result = await ticketListMenu({
      tickets: [],
      message: 'Select:',
      mode: 'checkbox',
      log: () => {},
    });
    expect(result).to.deep.equal([]);
  });

  it('logs the default empty message in interactive mode', async () => {
    const logged: string[] = [];
    await ticketListMenu({
      tickets: [],
      message: 'Select:',
      log: (msg) => logged.push(msg),
    });
    expect(logged).to.have.lengthOf(1);
    // Default message contains 'No tickets found.'
    expect(logged[0]).to.include('No tickets found.');
  });

  it('logs a custom emptyMessage when provided', async () => {
    const logged: string[] = [];
    await ticketListMenu({
      tickets: [],
      message: 'Select:',
      emptyMessage: 'Create a ticket first with: prlt ticket create',
      log: (msg) => logged.push(msg),
    });
    expect(logged[0]).to.equal('Create a ticket first with: prlt ticket create');
  });

  it('does not log in JSON mode when tickets are empty', async () => {
    const logged: string[] = [];
    const result = await ticketListMenu({
      tickets: [],
      message: 'Select:',
      emptyMessage: 'Should not appear',
      jsonMode: { flags: { json: true }, commandName: 'test' },
      log: (msg) => logged.push(msg),
    });
    expect(result).to.be.null;
    expect(logged).to.have.lengthOf(0);
  });
});

// ── ticketListMenu JSON mode ─────────────────────────────────────

describe('ticketListMenu JSON mode', () => {
  let originalExit: typeof process.exit;
  let originalLog: typeof console.log;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalExit = process.exit;
    originalLog = console.log;
    originalIsTTY = process.stdout.isTTY;

    // Force TTY so JSON is only triggered by the explicit flag
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    // Mock process.exit to throw a detectable sentinel
    (process as { exit: unknown }).exit = ((code: number) => {
      throw { __exitCode: code };
    }) as unknown as typeof process.exit;

    // Silence console.log by default
    (console as { log: unknown }).log = () => {};
  });

  afterEach(() => {
    process.exit = originalExit;
    console.log = originalLog;
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  });

  /** Helper: capture console.log, invoke fn, catch the exit sentinel */
  async function runWithCapture(
    fn: () => Promise<unknown>
  ): Promise<{ output: string; exitCode: number | undefined }> {
    const captured: string[] = [];
    (console as { log: unknown }).log = (msg: string) => captured.push(msg);

    let exitCode: number | undefined;
    try {
      await fn();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && '__exitCode' in e) {
        exitCode = (e as { __exitCode: number }).__exitCode;
      } else {
        throw e;
      }
    }
    return { output: captured[0] || '', exitCode };
  }

  it('outputs prompt schema and exits with code 2', async () => {
    const { output, exitCode } = await runWithCapture(() =>
      ticketListMenu({
        tickets: [
          makeTicket({ id: 'TKT-001', title: 'Alpha', priority: 'P1', statusName: 'Backlog' }),
        ],
        message: 'Select ticket:',
        jsonMode: { flags: { json: true }, commandName: 'test cmd' },
      })
    );

    expect(exitCode).to.equal(2);
    const parsed = JSON.parse(output);
    expect(parsed.prompt.type).to.equal('list');
    expect(parsed.prompt.message).to.equal('Select ticket:');
    expect(parsed.prompt.choices).to.have.lengthOf(1);
    expect(parsed.prompt.choices[0].name).to.equal('[P1] TKT-001 - Alpha [Backlog]');
    expect(parsed.prompt.choices[0].value).to.equal('TKT-001');
    expect(parsed.metadata.command).to.equal('test cmd');
  });

  it('uses plain text (no chalk codes) in JSON choices', async () => {
    const { output } = await runWithCapture(() =>
      ticketListMenu({
        tickets: [
          makeTicket({ id: 'TKT-001', title: 'No chalk', priority: 'P0', statusName: 'Done' }),
        ],
        message: 'Select:',
        jsonMode: { flags: { json: true }, commandName: 'test' },
      })
    );

    const parsed = JSON.parse(output);
    const name = parsed.prompt.choices[0].name as string;
    // Chalk escape sequences start with \x1b[ — should not be present
    expect(name).to.not.include('\x1b[');
    expect(name).to.equal('[P0] TKT-001 - No chalk [Done]');
  });

  it('outputs checkbox schema for multi-select mode', async () => {
    const { output, exitCode } = await runWithCapture(() =>
      ticketListMenu({
        tickets: [
          makeTicket({ id: 'TKT-001', title: 'First', priority: 'P0' }),
          makeTicket({ id: 'TKT-002', title: 'Second', priority: 'P1' }),
        ],
        message: 'Select tickets:',
        mode: 'checkbox',
        jsonMode: { flags: { json: true }, commandName: 'test' },
      })
    );

    expect(exitCode).to.equal(2);
    const parsed = JSON.parse(output);
    expect(parsed.prompt.type).to.equal('checkbox');
    expect(parsed.prompt.choices).to.have.lengthOf(2);
  });

  it('strips group separators from JSON output', async () => {
    const { output } = await runWithCapture(() =>
      ticketListMenu({
        tickets: [
          makeTicket({ id: 'TKT-001', title: 'Urgent', priority: 'P0' }),
          makeTicket({ id: 'TKT-002', title: 'Normal', priority: 'P2' }),
        ],
        message: 'Select:',
        groupByPriority: true,
        jsonMode: { flags: { json: true }, commandName: 'test' },
      })
    );

    const parsed = JSON.parse(output);
    // Only real choices, no separators
    expect(parsed.prompt.choices).to.have.lengthOf(2);
    for (const choice of parsed.prompt.choices) {
      expect(choice).to.have.property('name');
      expect(choice).to.have.property('value');
      // Separators would have a 'type' field — real choices should not
      expect(choice).to.not.have.property('type');
    }
  });

  it('includes command field when getCommand is provided', async () => {
    const { output } = await runWithCapture(() =>
      ticketListMenu({
        tickets: [
          makeTicket({ id: 'TKT-001', title: 'Cmd test', priority: 'P0' }),
        ],
        message: 'Select:',
        jsonMode: { flags: { json: true }, commandName: 'test' },
        getCommand: (t) => `prlt work start ${t.id} --json`,
      })
    );

    const parsed = JSON.parse(output);
    expect(parsed.prompt.choices[0].command).to.equal('prlt work start TKT-001 --json');
  });

  it('shows assignee in JSON output when showAssignee is true', async () => {
    const { output } = await runWithCapture(() =>
      ticketListMenu({
        tickets: [
          makeTicket({ id: 'TKT-001', title: 'Assigned', priority: 'P1', assignee: 'dave' }),
        ],
        message: 'Select:',
        showAssignee: true,
        jsonMode: { flags: { json: true }, commandName: 'test' },
      })
    );

    const parsed = JSON.parse(output);
    expect(parsed.prompt.choices[0].name).to.include('(dave)');
  });

  it('shows [None] for tickets without priority in JSON output', async () => {
    const { output } = await runWithCapture(() =>
      ticketListMenu({
        tickets: [makeTicket({ id: 'TKT-001', title: 'No pri' })],
        message: 'Select:',
        jsonMode: { flags: { json: true }, commandName: 'test' },
      })
    );

    const parsed = JSON.parse(output);
    expect(parsed.prompt.choices[0].name).to.match(/^\[None\]/);
  });
});

// ── listMenu JSON mode (generic) ─────────────────────────────────

describe('listMenu JSON mode', () => {
  let originalExit: typeof process.exit;
  let originalLog: typeof console.log;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalExit = process.exit;
    originalLog = console.log;
    originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    (process as { exit: unknown }).exit = ((code: number) => {
      throw { __exitCode: code };
    }) as unknown as typeof process.exit;
    (console as { log: unknown }).log = () => {};
  });

  afterEach(() => {
    process.exit = originalExit;
    console.log = originalLog;
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  });

  async function runWithCapture(
    fn: () => Promise<unknown>
  ): Promise<{ output: string; exitCode: number | undefined }> {
    const captured: string[] = [];
    (console as { log: unknown }).log = (msg: string) => captured.push(msg);
    let exitCode: number | undefined;
    try {
      await fn();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && '__exitCode' in e) {
        exitCode = (e as { __exitCode: number }).__exitCode;
      } else {
        throw e;
      }
    }
    return { output: captured[0] || '', exitCode };
  }

  it('uses formatPlain for JSON output when provided', async () => {
    const { output } = await runWithCapture(() =>
      listMenu({
        items: [{ id: '1', label: 'Styled Label' }],
        format: (i) => `\x1b[36m${i.label}\x1b[39m`, // fake chalk
        formatPlain: (i) => `PLAIN: ${i.label}`,
        getValue: (i) => i.id,
        message: 'Pick:',
        jsonMode: { flags: { json: true }, commandName: 'test' },
      })
    );

    const parsed = JSON.parse(output);
    expect(parsed.prompt.choices[0].name).to.equal('PLAIN: Styled Label');
  });

  it('falls back to format when formatPlain is not provided', async () => {
    const { output } = await runWithCapture(() =>
      listMenu({
        items: [{ id: '1', label: 'Only Format' }],
        format: (i) => `FORMAT: ${i.label}`,
        getValue: (i) => i.id,
        message: 'Pick:',
        jsonMode: { flags: { json: true }, commandName: 'test' },
      })
    );

    const parsed = JSON.parse(output);
    expect(parsed.prompt.choices[0].name).to.equal('FORMAT: Only Format');
  });

  it('includes grouped choices in correct priority order with separators stripped', async () => {
    const { output } = await runWithCapture(() =>
      listMenu({
        items: [
          { id: '1', group: 'B' },
          { id: '2', group: 'A' },
          { id: '3', group: 'B' },
        ],
        format: (i) => `Item ${i.id}`,
        getValue: (i) => i.id,
        message: 'Pick:',
        groupBy: (i) => i.group,
        groupOrder: ['A', 'B'],
        jsonMode: { flags: { json: true }, commandName: 'test' },
      })
    );

    const parsed = JSON.parse(output);
    // A comes first (id:2), then B (id:1, id:3)
    expect(parsed.prompt.choices.map((c: { value: string }) => c.value)).to.deep.equal([
      '2', '1', '3',
    ]);
  });
});
