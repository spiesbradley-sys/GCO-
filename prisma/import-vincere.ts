import { PrismaClient } from '@prisma/client';
import { monthlyCloseDate, closeMonthsBetween, periodLabel, WHITE_LABEL_CLOSE_BD, type Frequency } from '../src/desk/compute';

// Idempotent import of the work we do for Vincere's clients, from "List for GCO.xlsx".
//
// Vincere Tax is the ONE client (white label). The businesses we do the work for are
// NOT GCO clients: each is just an ENGAGEMENT under Vincere that names the business in
// its "End client" field. For each row this creates that engagement and the cycles its
// delivery frequency calls for. Safe to re-run: engagements are matched by
// (client = Vincere, end client), existing rows are left alone, blanks are filled.
//
//   tsx prisma/import-vincere.ts            # DRY RUN — prints the plan, writes nothing
//   tsx prisma/import-vincere.ts --apply    # writes to whatever DATABASE_URL points at
//
// People map to DeskUsers by full name, first name, or the email's first name. Anyone
// without a match is left blank and reported — nothing is invented.
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const CLIENT_NAME = 'Vincere Tax';
const ACCOUNTANT = 'Prosper';
const CONTROLLER = 'Hillary';
/** First close period to create cycles for (the work board shows September as in progress). */
const START_MONTH = '2026-09';
const NOW_MONTH = new Date().toISOString().slice(0, 7);
const CREATED_BY = 'import';

type Row = { endClient: string; delivery: Frequency; priority: string };

// Rows 4–16 of the "all work board - books, payroll" sheet (Managed Bookkeeping).
const ROWS: Row[] = [
  { endClient: 'Fur Feather Friends Vet Hospital', delivery: 'Monthly', priority: 'B' },
  { endClient: 'TV Retreats LLC', delivery: 'Monthly', priority: 'C' },
  { endClient: 'EKMA Holdings', delivery: 'Monthly', priority: 'C' },
  { endClient: 'Top Suite', delivery: 'Monthly', priority: 'C' },
  { endClient: 'Knight Street Apartments', delivery: 'Monthly', priority: 'C' },
  { endClient: 'Nishant Memphis', delivery: 'Monthly', priority: 'C' },
  { endClient: 'Rampar LLC', delivery: 'Quarterly', priority: 'C' },
  { endClient: '360 Aviation Advisors', delivery: 'Quarterly', priority: 'C' },
  { endClient: 'Silicon Valley Ventures', delivery: 'Quarterly', priority: 'C' },
  { endClient: 'Swet Seminole', delivery: 'Monthly', priority: 'B' },
  { endClient: 'Swet St Pete', delivery: 'Monthly', priority: 'B' },
  { endClient: 'We Swet LLC', delivery: 'Monthly', priority: 'B' },
  { endClient: 'NJS Holdings', delivery: 'Monthly', priority: 'B' },
];

// A one-off clean-up we are doing for Vincere (row 17). Not recurring, so it gets no cycles.
const CLEANUP = { endClient: 'Martin Monroe', start: '2026-09-28' };

const log = (s = '') => console.log(s);
const via = (end: string) => `${end} (via ${CLIENT_NAME})`;

async function main() {
  log(APPLY ? 'APPLYING import to the database in DATABASE_URL…' : 'DRY RUN — nothing will be written (pass --apply to write).');
  log();

  // ── People ────────────────────────────────────────────────────────────────
  const users = await prisma.deskUser.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true } });
  const unmatched = new Set<string>();
  const ambiguous = new Set<string>();
  const personId = (label: string): string | null => {
    const l = label.toLowerCase();
    const exact = users.filter((u) => (u.name ?? '').trim().toLowerCase() === l);
    if (exact.length === 1) return exact[0].id;
    // Names are often blank on invited users, so also match the first name or the
    // email's first name ("prosper.chamonyonga@…" -> "prosper").
    const first = users.filter(
      (u) => (u.name ?? '').trim().toLowerCase().split(/\s+/)[0] === l || u.email.toLowerCase().split('@')[0].split(/[._-]/)[0] === l,
    );
    if (first.length === 1) return first[0].id;
    (first.length > 1 ? ambiguous : unmatched).add(label);
    return null;
  };
  const bookkeeper = personId(ACCOUNTANT);
  const controller = personId(CONTROLLER);

  // ── The one client: Vincere Tax (white label) ─────────────────────────────
  let client = await prisma.deskClient.findFirst({ where: { name: { contains: 'vincere', mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } });
  if (!client) {
    log(`+ client "${CLIENT_NAME}" (white label) — not found, will create`);
    if (APPLY) client = await prisma.deskClient.create({ data: { name: CLIENT_NAME, status: 'Ongoing', whiteLabel: true, createdBy: CREATED_BY, updatedBy: CREATED_BY } });
  } else if (!client.whiteLabel) {
    log(`~ client "${client.name}" found; will mark it white label`);
    if (APPLY) client = await prisma.deskClient.update({ where: { id: client.id }, data: { whiteLabel: true, updatedBy: CREATED_BY } });
  } else {
    log(`= client "${client.name}" already set up as white label`);
  }
  const clientId = client?.id ?? null;
  const clientName = client?.name ?? CLIENT_NAME;

  const tally = { engagements: 0, cycles: 0, filled: 0 };
  const findEngagement = (end: string, service: string) =>
    clientId ? prisma.deskEngagement.findFirst({ where: { client: clientId, service, endClient: { equals: end, mode: 'insensitive' } } }) : null;

  // ── Recurring engagements ─────────────────────────────────────────────────
  log();
  for (const r of ROWS) {
    const existing = await findEngagement(r.endClient, 'Managed Bookkeeping');
    let engId = existing?.id ?? null;

    if (!existing) {
      tally.engagements++;
      if (APPLY && clientId) {
        const e = await prisma.deskEngagement.create({
          data: {
            name: `${r.endClient} (via ${clientName})`,
            client: clientId,
            endClient: r.endClient,
            service: 'Managed Bookkeeping',
            status: 'Active',
            frequency: r.delivery,
            bookkeeper,
            controller,
            start: `${START_MONTH}-01`,
            scope: `White label via ${clientName}. Priority ${r.priority}.`,
            createdBy: CREATED_BY,
            updatedBy: CREATED_BY,
          },
        });
        engId = e.id;
        await prisma.deskAuditLog.create({ data: { action: 'record_created', actorEmail: 'import-vincere', board: 'engagements', recordId: e.id, summary: e.name } });
      }
    } else {
      // Re-run: fill blanks (user invited since, frequency newly added) but never overwrite a value that is set.
      const fill = {
        ...(!existing.bookkeeper && bookkeeper ? { bookkeeper } : {}),
        ...(!existing.controller && controller ? { controller } : {}),
        ...(!existing.frequency ? { frequency: r.delivery } : {}),
      };
      if (Object.keys(fill).length) {
        tally.filled++;
        if (APPLY) await prisma.deskEngagement.update({ where: { id: existing.id }, data: { ...fill, updatedBy: CREATED_BY } });
      }
    }

    // Cycles: one per close period this frequency calls for (Monthly = every month, Quarterly = Mar/Jun/Sep/Dec).
    const months = closeMonthsBetween(r.delivery, START_MONTH, NOW_MONTH);
    const have = new Set(
      engId ? (await prisma.deskCycle.findMany({ where: { engagement: engId }, select: { period: true } })).map((c) => (c.period ?? '').slice(0, 7)) : [],
    );
    const made: string[] = [];
    for (const mk of months) {
      if (have.has(mk)) continue;
      tally.cycles++;
      const period = `${mk}-01`;
      const due = monthlyCloseDate(period, WHITE_LABEL_CLOSE_BD);
      made.push(`${periodLabel(r.delivery, mk)} (due ${due})`);
      if (APPLY && engId) {
        const name = `${via(r.endClient)} — ${periodLabel(r.delivery, mk)}`;
        // The work board has September "Ready to Work", i.e. the month is closed and capture can start.
        const stage = mk < NOW_MONTH ? 'Capture' : 'Awaiting Close';
        const c = await prisma.deskCycle.create({ data: { name, engagement: engId, period, stage, slaDue: due, createdBy: CREATED_BY, updatedBy: CREATED_BY } });
        await prisma.deskAuditLog.create({ data: { action: 'record_created', actorEmail: 'import-vincere', board: 'cycles', recordId: c.id, summary: `${name} (import)` } });
      }
    }
    log(`${existing ? '=' : '+'} ${r.endClient.padEnd(34)} ${r.delivery.padEnd(10)} cycles: ${made.length ? made.join(', ') : 'none to add'}`);
  }

  // ── One-off clean-up ──────────────────────────────────────────────────────
  {
    const existing = await findEngagement(CLEANUP.endClient, 'Cleanup/Catch-up');
    if (!existing) {
      tally.engagements++;
      if (APPLY && clientId) {
        const e = await prisma.deskEngagement.create({
          data: {
            name: `${via(CLEANUP.endClient)} — Clean-up`,
            client: clientId,
            endClient: CLEANUP.endClient,
            service: 'Cleanup/Catch-up',
            status: 'Active',
            bookkeeper,
            controller,
            start: CLEANUP.start,
            scope: `Clean-up job we are doing for ${clientName}. One-off, so no recurring cycles.`,
            createdBy: CREATED_BY,
            updatedBy: CREATED_BY,
          },
        });
        await prisma.deskAuditLog.create({ data: { action: 'record_created', actorEmail: 'import-vincere', board: 'engagements', recordId: e.id, summary: e.name } });
      }
    }
    log(`${existing ? '=' : '+'} ${CLEANUP.endClient.padEnd(34)} ${'Clean-up'.padEnd(10)} one-off, no recurring cycles`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log();
  log(
    `${APPLY ? 'Created' : 'Would create'}: ${tally.engagements} engagement(s) under ${clientName}, ${tally.cycles} cycle(s)` +
      (tally.filled ? `; ${APPLY ? 'filled' : 'would fill'} blanks on ${tally.filled} existing engagement(s)` : '') +
      '. No client records are created for the end clients.',
  );
  log(`Cycle close dates use ${WHITE_LABEL_CLOSE_BD} business days after period end (white label).`);
  if (unmatched.size) {
    log(`\nNo matching desk user — these assignments are left BLANK (invite them under Team, then re-run to fill):`);
    unmatched.forEach((n) => log(`  - ${n}`));
  }
  if (ambiguous.size) {
    log(`\nMore than one desk user matches — these assignments are left BLANK (use full names to disambiguate):`);
    ambiguous.forEach((n) => log(`  - ${n}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
