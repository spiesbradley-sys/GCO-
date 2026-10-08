import type { BoardKey, DeskRole } from './roles';

// Board schema — mirrors the reference `BOARDS` object field-for-field, in order.
// Drives generic table/kanban/drawer rendering and server-side write validation.
// Calc fields are computed server-side (see enrichRows) and read like any value.

export type ChipColor =
  | 'gray'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'purple'
  | 'pink'
  | 'brown';

export type FieldType =
  | 'title'
  | 'text'
  | 'long'
  | 'select'
  | 'multi'
  | 'check'
  | 'money'
  | 'num'
  | 'date'
  | 'rel'
  | 'person'
  | 'url'
  | 'calc';

export type Opt = { name: string; color: ChipColor };

export type Field = {
  k: string;
  l: string;
  t: FieldType;
  o?: Opt[];
  to?: BoardKey; // rel target
  hint?: string;
  /** person fields only: restrict the picker to these roles (the current
   * assignee is always kept selectable even if their role is not listed). */
  pr?: DeskRole[];
  /** only these roles may edit the field; everyone else sees it read-only
   * (enforced server-side in updateRecord). */
  lock?: DeskRole[];
  /** calc kind computed server-side */
  calc?: 'rack' | 'dealClock' | 'margin' | 'marginPct' | 'queryAge' | 'blockers';
  money?: boolean; // calc renders as money
  num?: boolean; // calc renders right-aligned numeric
};

export type View = {
  n: string;
  type: 'table' | 'board';
  cols?: string[];
  group?: string;
  cardMeta?: string[];
  filter?: 'openQueries' | 'slaWatch';
  sort?: 'raisedAsc' | 'slaDueAsc';
  totals?: boolean;
  hideEmpty?: boolean;
  sev?: 'cycle';
};

export type Board = {
  key: BoardKey;
  label: string;
  short: string;
  step?: number;
  singular: string;
  blurb: string;
  fields: Field[];
  back?: { b: BoardKey; k: string; l: string }[];
  views: View[];
};

const o = (defs: Array<[string, ChipColor?]>): Opt[] =>
  defs.map(([name, color]) => ({ name, color: color ?? 'gray' }));

export const BOARDS: Record<BoardKey, Board> = {
  intake: {
    key: 'intake',
    label: 'Client Onboarding',
    short: 'Onboarding',
    step: 1,
    singular: 'Submission',
    blurb:
      "The client's own answers about how their business works. Each submission shapes the chart of accounts and the first dashboard.",
    fields: [
      { k: 'name', l: 'Company Name', t: 'title' },
      { k: 'email', l: 'Contact Email', t: 'text' },
      {
        k: 'accounting',
        l: 'Accounting Software',
        t: 'multi',
        o: o([
          ['QuickBooks Online', 'blue'],
          ['QuickBooks Desktop', 'blue'],
          ['Xero', 'green'],
          ['Sage', 'orange'],
          ['FreshBooks', 'purple'],
          ['NetSuite', 'red'],
          ['Wave', 'yellow'],
          ['Other'],
        ]),
      },
      {
        k: 'payments',
        l: 'Payment Platforms',
        t: 'multi',
        o: o([
          ['Stripe', 'purple'],
          ['Square'],
          ['Bill.com', 'brown'],
          ['PayPal', 'blue'],
          ['Shopify Payments', 'green'],
          ['Braintree', 'blue'],
          ['Authorize.net', 'orange'],
          ['Bank ACH / Wire', 'yellow'],
          ['Other'],
        ]),
      },
      {
        k: 'access',
        l: 'Access this week?',
        t: 'select',
        o: o([
          ['Yes - ready now', 'green'],
          ['Yes - within a few days', 'blue'],
          ['Need to check internally', 'yellow'],
          ['Not sure yet'],
        ]),
      },
      { k: 'goodMonth', l: 'How do you know you had a good month?', t: 'long', hint: 'Becomes the dashboard headline number' },
      { k: 'structure', l: 'Structure and top three 12-month goals', t: 'long' },
      { k: 'clarity', l: 'Revenue streams: clearest vs murkiest', t: 'long' },
      { k: 'buyJourney', l: 'How a customer buys, start to finish', t: 'long' },
      { k: 'monday', l: 'The one Monday-morning report', t: 'long', hint: 'Becomes the first dashboard we build' },
      { k: 'firstWin', l: 'What makes month one a clear win', t: 'long' },
      { k: 'tools', l: 'Other software and tools', t: 'long' },
      { k: 'extra', l: 'Anything else / questions', t: 'long' },
    ],
    views: [{ n: 'Submissions', type: 'table', cols: ['name', 'email', 'accounting', 'payments', 'access', 'goodMonth'] }],
  },

  clients: {
    key: 'clients',
    label: 'Clients',
    short: 'Clients',
    step: 2,
    singular: 'Client',
    blurb:
      'One row per client: the entity of record, how to reach them, what they run on, and whether we are fully live.',
    fields: [
      { k: 'name', l: 'Client Name', t: 'title' },
      { k: 'status', l: 'Status', t: 'select', o: o([['Prospect'], ['Pilot', 'yellow'], ['Ongoing', 'green'], ['Offboarded', 'red']]) },
      { k: 'legal', l: 'Legal Entity', t: 'text' },
      { k: 'location', l: 'Location', t: 'text' },
      { k: 'contact', l: 'Primary Contact', t: 'text' },
      { k: 'email', l: 'Contact Email', t: 'text' },
      { k: 'onboarding', l: 'Onboarding Status', t: 'select', o: o([['Not started'], ['In progress', 'blue'], ['Done', 'green']]) },
      { k: 'access', l: 'Systems Access', t: 'select', o: o([['Not yet granted', 'red'], ['Partial', 'yellow'], ['Full access live', 'green']]) },
      { k: 'system', l: 'Accounting System', t: 'select', o: o([['QuickBooks Online', 'blue'], ['Xero', 'green'], ['Other']]) },
      { k: 'bank', l: 'Bank Feed Health', t: 'select', o: o([['Connected', 'green'], ['Issue', 'red'], ['Not set up']]) },
      { k: 'letter', l: 'Engagement Letter Signed', t: 'check' },
      { k: 'fee', l: 'Monthly Fee', t: 'money' },
      { k: 'start', l: 'Start Date', t: 'date' },
      {
        k: 'streams',
        l: 'Revenue Streams',
        t: 'multi',
        o: o([
          ['Online courses', 'blue'],
          ['Bootcamps', 'orange'],
          ['Enterprise/DSO contracts', 'purple'],
          ['Podcast', 'pink'],
          ['Consulting', 'green'],
          ['Other'],
        ]),
      },
      { k: 'intake', l: 'Onboarding Form', t: 'rel', to: 'intake' },
      { k: 'notes', l: 'Notes', t: 'long' },
    ],
    back: [{ b: 'engagements', k: 'client', l: 'Engagements' }],
    views: [
      { n: 'All clients', type: 'table', cols: ['name', 'status', 'onboarding', 'access', 'system', 'bank', 'letter', 'fee'] },
      { n: 'By status', type: 'board', group: 'status', cardMeta: ['access', 'fee'] },
    ],
  },

  engagements: {
    key: 'engagements',
    label: 'Engagements',
    short: 'Engagements',
    step: 3,
    singular: 'Engagement',
    blurb:
      'One row per contract. Scope, SLAs, fees and exclusions live here. Anything not in the scope summary is a change order.',
    fields: [
      { k: 'name', l: 'Engagement', t: 'title' },
      { k: 'client', l: 'Client', t: 'rel', to: 'clients' },
      { k: 'service', l: 'Service Type', t: 'select', o: o([['Managed Bookkeeping', 'green'], ['QoE Lite', 'purple'], ['Cleanup/Catch-up', 'orange'], ['Other']]) },
      { k: 'status', l: 'Status', t: 'select', o: o([['Pilot', 'yellow'], ['Active', 'green'], ['Paused', 'orange'], ['Ended', 'red']]) },
      { k: 'fee', l: 'Monthly Fee', t: 'money' },
      { k: 'slaDelivery', l: 'SLA: Delivery (BD from close)', t: 'num' },
      { k: 'slaMeeting', l: 'SLA: Meeting (BD from delivery)', t: 'num' },
      { k: 'slaQuery', l: 'SLA: Query response (BD)', t: 'num' },
      { k: 'controller', l: 'Financial Controller', t: 'person', pr: ['controller', 'management', 'owner'], lock: ['controller', 'management', 'owner'], hint: 'Sees this engagement; controllers see all. Set by controllers/management.' },
      { k: 'bookkeeper', l: 'Accountant', t: 'person', pr: ['accountant', 'management', 'owner'], lock: ['controller', 'management', 'owner'], hint: 'The assigned accountant sees only engagements assigned to them. Set by controllers/management.' },
      { k: 'start', l: 'Start Date', t: 'date' },
      { k: 'pilotEnd', l: 'Pilot End Date', t: 'date' },
      { k: 'scope', l: 'Scope Summary', t: 'long' },
      { k: 'exclusions', l: 'Exclusions', t: 'long' },
    ],
    back: [{ b: 'cycles', k: 'engagement', l: 'Monthly Cycles' }],
    views: [
      { n: 'All engagements', type: 'table', cols: ['name', 'client', 'service', 'status', 'fee', 'slaDelivery', 'bookkeeper'] },
      { n: 'By service', type: 'board', group: 'service', cardMeta: ['status', 'fee'] },
    ],
  },

  cycles: {
    key: 'cycles',
    label: 'Monthly Cycles',
    short: 'Monthly Cycles',
    step: 4,
    singular: 'Cycle',
    blurb:
      'The production line. One record per engagement per month, moving through eight stages, each with its own SLA clock.',
    fields: [
      { k: 'name', l: 'Cycle', t: 'title' },
      { k: 'engagement', l: 'Engagement', t: 'rel', to: 'engagements' },
      { k: 'period', l: 'Period', t: 'date', hint: 'Month being closed — sets the close date automatically' },
      {
        k: 'stage',
        l: 'Stage',
        t: 'select',
        o: o([
          ['Awaiting Close'],
          ['Capture', 'blue'],
          ['Reconciliation', 'purple'],
          ['Review', 'orange'],
          ['Dashboard Prep', 'yellow'],
          ['Delivered', 'green'],
          ['Meeting Held', 'green'],
          ['Closed'],
        ]),
      },
      { k: 'capture', l: 'Claude Capture Done', t: 'check' },
      { k: 'bkReview', l: 'Bookkeeper Review Done', t: 'check' },
      { k: 'ctrlReview', l: 'Controller Review Done', t: 'check' },
      { k: 'slaDue', l: 'Close date (SLA)', t: 'date', hint: 'Auto: 5 business days after month-end. Override only for exceptions.' },
      { k: 'slaStatus', l: 'SLA Status', t: 'select', o: o([['On track', 'green'], ['At risk', 'yellow'], ['Breached', 'red'], ['Clock paused'], ['Met', 'blue']]) },
      { k: 'blockers', l: 'Open Blockers', t: 'calc', calc: 'blockers', num: true },
      { k: 'delivered', l: 'Delivered On', t: 'date' },
      { k: 'meeting', l: 'Meeting Date', t: 'date' },
      { k: 'notes', l: 'Cycle Notes', t: 'long' },
    ],
    back: [
      { b: 'queries', k: 'cycle', l: 'Queries & Blockers' },
      { b: 'deliverables', k: 'cycle', l: 'Deliverables' },
    ],
    views: [
      { n: 'Production Board', type: 'board', group: 'stage', cardMeta: ['slaStatus', 'slaDue', 'blockers'], sev: 'cycle' },
      { n: 'SLA Watch', type: 'table', cols: ['name', 'stage', 'slaDue', 'slaStatus', 'blockers', 'delivered'], filter: 'slaWatch', sort: 'slaDueAsc' },
      { n: 'All cycles', type: 'table', cols: ['name', 'engagement', 'period', 'stage', 'capture', 'bkReview', 'ctrlReview', 'slaStatus', 'delivered'] },
    ],
  },

  queries: {
    key: 'queries',
    label: 'Queries & Blockers',
    short: 'Queries & Blockers',
    step: 5,
    singular: 'Query',
    blurb:
      'Every open question or access issue, with dates. A logged blocker is what pauses an SLA clock, so log the moment it appears.',
    fields: [
      { k: 'name', l: 'Query', t: 'title' },
      { k: 'cycle', l: 'Cycle', t: 'rel', to: 'cycles' },
      { k: 'type', l: 'Type', t: 'select', o: o([['Client query', 'blue'], ['Missing documentation', 'orange'], ['Access issue', 'red'], ['Bank feed disconnected', 'red'], ['Internal question']]) },
      { k: 'status', l: 'Status', t: 'select', o: o([['Open', 'red'], ['Awaiting client', 'yellow'], ['Resolved', 'green']]) },
      { k: 'blocks', l: 'Blocks SLA Clock', t: 'check' },
      { k: 'raised', l: 'Raised On', t: 'date' },
      { k: 'responded', l: 'Client Responded On', t: 'date' },
      { k: 'resolved', l: 'Resolved On', t: 'date' },
      { k: 'age', l: 'Age', t: 'calc', calc: 'queryAge', num: true },
      { k: 'owner', l: 'Owner', t: 'person' },
      { k: 'details', l: 'Details', t: 'long' },
    ],
    views: [
      { n: 'Open Items', type: 'table', cols: ['name', 'cycle', 'type', 'status', 'blocks', 'raised', 'age', 'owner'], filter: 'openQueries', sort: 'raisedAsc' },
      { n: 'By status', type: 'board', group: 'status', cardMeta: ['type', 'raised', 'owner'] },
      { n: 'All queries', type: 'table', cols: ['name', 'cycle', 'type', 'status', 'raised', 'responded', 'resolved'] },
    ],
  },

  deliverables: {
    key: 'deliverables',
    label: 'Deliverables',
    short: 'Deliverables',
    step: 6,
    singular: 'Deliverable',
    blurb:
      'Everything we hand a client, filed against the cycle that produced it. Nothing goes out without a QC sign-off name.',
    fields: [
      { k: 'name', l: 'Deliverable', t: 'title' },
      { k: 'cycle', l: 'Cycle', t: 'rel', to: 'cycles' },
      { k: 'type', l: 'Type', t: 'select', o: o([['Monthly dashboard', 'green'], ['Management accounts', 'blue'], ['Meeting notes', 'yellow'], ['Reconciliation pack', 'purple'], ['Other']]) },
      { k: 'delivered', l: 'Delivered On', t: 'date' },
      { k: 'qc', l: 'QC Sign-off', t: 'person' },
      { k: 'file', l: 'File link', t: 'url' },
      { k: 'notes', l: 'Notes', t: 'long' },
    ],
    views: [
      { n: 'Archive', type: 'table', cols: ['name', 'cycle', 'type', 'delivered', 'qc'] },
      { n: 'By type', type: 'board', group: 'type', cardMeta: ['delivered', 'qc'] },
    ],
  },

  deals: {
    key: 'deals',
    label: 'QofE Lite Pipeline',
    short: 'QofE Lite Pipeline',
    singular: 'Deal',
    blurb:
      'Every QoE deal from first intro to delivery. Turnaround is measured from a clean, complete data pack to draft 1.',
    fields: [
      { k: 'name', l: 'Deal name', t: 'title' },
      {
        k: 'stage',
        l: 'Stage',
        t: 'select',
        o: o([
          ['Intro'],
          ['LoE sent', 'blue'],
          ['LoE signed by dentist', 'blue'],
          ['LoE counter-signed by GCO Partners', 'purple'],
          ['Data received', 'orange'],
          ['Analysis Started - Info Outstanding', 'pink'],
          ['Analysis - Outstanding Info received'],
          ['Analysis (Hillary)', 'yellow'],
          ['Review (Bradley)', 'yellow'],
          ['LqE sent to broker - awaiting feedback', 'red'],
          ['LqE finalized', 'green'],
          ['Delivered', 'green'],
        ]),
      },
      { k: 'source', l: 'Source', t: 'select', o: o([['Broker', 'blue'], ['Direct', 'green']]) },
      { k: 'broker', l: 'Broker', t: 'text' },
      { k: 'posture', l: 'Data posture', t: 'select', o: o([['Data-light', 'green'], ['PHI', 'red']]) },
      { k: 'locations', l: 'Locations', t: 'num' },
      { k: 'fee', l: 'Fee', t: 'money' },
      { k: 'rack', l: 'Rack rate / clock', t: 'calc', calc: 'rack' },
      { k: 'payment', l: 'Payment Status', t: 'select', o: o([['Not Billed'], ['Billed', 'blue'], ['Delayed', 'orange'], ['Paid', 'green']]) },
      { k: 'review', l: 'Google Review', t: 'select', o: o([['Not started'], ['In progress', 'blue'], ['Done', 'green']]) },
      { k: 'owner', l: 'Owner', t: 'person' },
      { k: 'reviewer', l: 'Reviewer', t: 'person' },
      { k: 'entity', l: 'Entity type', t: 'select', o: o([['Sole prop'], ['PLLC', 'blue'], ['PC', 'purple']]) },
      { k: 'state', l: 'Practice state', t: 'text' },
      { k: 'pms', l: 'PMS platform', t: 'text' },
      { k: 'periods', l: 'Financial periods', t: 'text' },
      { k: 'created', l: 'Created', t: 'date' },
      { k: 'dataReceived', l: 'Data received at', t: 'date' },
      { k: 'finalized', l: 'LqE finalized at', t: 'date' },
      { k: 'clock', l: 'Draft clock', t: 'calc', calc: 'dealClock' },
      { k: 'outstandings', l: 'Outstandings', t: 'long' },
      { k: 'learnings', l: 'Learnings for GCO', t: 'long' },
      { k: 'notes', l: 'Notes', t: 'long' },
    ],
    views: [
      { n: 'Pipeline', type: 'board', group: 'stage', cardMeta: ['broker', 'locations', 'fee', 'payment'], hideEmpty: true },
      { n: 'All deals', type: 'table', cols: ['name', 'stage', 'broker', 'posture', 'locations', 'fee', 'rack', 'payment', 'owner'] },
      { n: 'Payments', type: 'board', group: 'payment', cardMeta: ['fee', 'stage'] },
    ],
  },

  pnl: {
    key: 'pnl',
    label: 'Dental P&L',
    short: 'Dental P&L',
    singular: 'P&L row',
    blurb: 'Revenue, directly attributable cost and margin per engagement, one row per period.',
    fields: [
      { k: 'name', l: 'Engagement', t: 'title' },
      { k: 'party', l: 'Client / Broker', t: 'text' },
      { k: 'month', l: 'Month', t: 'text' },
      { k: 'service', l: 'Service Type', t: 'select', o: o([['QoE Lite', 'purple'], ['Managed Bookkeeping', 'green'], ['Cleanup/Catch-up', 'orange'], ['Other']]) },
      { k: 'revType', l: 'Revenue Type', t: 'select', o: o([['One-off', 'blue'], ['Recurring (monthly)', 'green']]) },
      { k: 'revenue', l: 'Revenue', t: 'money' },
      { k: 'delivery', l: 'Delivery Cost', t: 'money' },
      { k: 'commission', l: 'Commission', t: 'money' },
      { k: 'other', l: 'Other Costs', t: 'money' },
      { k: 'margin', l: 'Gross Margin', t: 'calc', calc: 'margin', money: true, num: true },
      { k: 'marginPct', l: 'Margin %', t: 'calc', calc: 'marginPct', num: true },
      { k: 'status', l: 'Status', t: 'select', o: o([['Pilot', 'yellow'], ['Active', 'green'], ['In progress', 'blue'], ['Delivered', 'green'], ['Paused', 'orange'], ['Ended', 'red']]) },
      { k: 'recurring', l: 'Recurring Status', t: 'select', o: o([['Active', 'green'], ['Inactive'], ['Yet to start', 'yellow']]) },
      { k: 'start', l: 'Start Date', t: 'date' },
      { k: 'notes', l: 'Notes', t: 'long' },
    ],
    views: [
      { n: 'All rows', type: 'table', cols: ['name', 'month', 'service', 'revType', 'revenue', 'delivery', 'commission', 'margin', 'marginPct', 'status'], totals: true },
      { n: 'By service', type: 'board', group: 'service', cardMeta: ['month', 'revenue', 'marginPct'] },
    ],
  },
};

/** Managed-accounting boards, in work-flow order (steps 1–6). */
export const MANAGED_ORDER: BoardKey[] = ['intake', 'clients', 'engagements', 'cycles', 'queries', 'deliverables'];

export const field = (b: BoardKey, k: string): Field | undefined => BOARDS[b].fields.find((f) => f.k === k);

export const optColor = (f: Field, v: string): ChipColor =>
  (f.o?.find((x) => x.name === v)?.color as ChipColor) ?? 'gray';
