import { PrismaClient } from '@prisma/client';
import { monthlyCloseDate, closeMonthsBetween, periodLabel, WHITE_LABEL_CLOSE_BD, type Frequency } from '../src/desk/compute';

// Idempotent import of Vincere's end clients (white label) from "List for GCO.xlsx".
// For each end client it creates a DeskClient (parent = Vincere), an engagement,
// and the cycles that engagement's delivery frequency calls for. Safe to re-run:
// existing rows are matched by name (and parent / client) and left untouched,
// except that blank assignments / frequency are filled in.
//
//   tsx prisma/import-vincere.ts            # DRY RUN — prints the plan, writes nothing
//   tsx prisma/import-vincere.ts --apply    # writes to whatever DATABASE_URL points at
//
// People map to DeskUsers by full name, or by first name when that is unique.
// Anyone without a match is left blank and reported — nothing is invented.
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const PARENT_NAME = 'Vincere Tax';
const ACCOUNTANT = 'Prosper';
const CONTROLLER = 'Hillary';
/** First close period to create cycles for (the work board shows September as in progress). */
const START_MONTH = '2026-09';
const NOW_MONTH = new Date().toISOString().slice(0, 7);

type Row = { name: string; delivery: Frequency; priority: string };

// Rows 4–16 of the "all work board - books, payroll" sheet (Managed Bookkeeping).
const ROWS: Row[] = [
  { name: 'Fur Feather Friends Vet Hospital', delivery: 'Monthly', priority: 'B' },
  { name: 'TV Retreats LLC', delivery: 'Monthly', priority: 'C' },
  { name: 'EKMA Holdings', delivery: 'Monthly', priority: 'C' },
  { name: 'Top Suite', delivery: 'Monthly', priority: 'C' },
  { name: 'Knight Street Apartments', delivery: 'Monthly', priority: 'C' },
  { name: 'Nishant Memphis', delivery: 'Monthly', priority: 'C' },
  { name: 'Rampar LLC', delivery: 'Quarterly', priority: 'C' },
  { name: '360 Aviation Advisors', delivery: 'Quarterly', priority: 'C' },
  { name: 'Silicon Valley Ventures', delivery: 'Quarterly', priority: 'C' },
  { name: 'Swet Seminole', delivery: 'Monthly', priority: 'B' },
  { name: 'Swet St Pete', delivery: 'Monthly', priority: 'B' },
  { name: 'We Swet LLC', delivery: 'Monthly', priority: 'B' },
  { name: 'NJS Holdings', delivery: 'Monthly', priority: 'B' },
];

// A one-off clean-up we are doing for Vincere (row 17). Not recurring, so it gets no cycles.
const CLEANUP = { name: 'Martin Monroe', start: '2026-09-28' };

const log = (s = '') => console.log(s);
const CREATED_BY = 'import';

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

  // ── Parent (white-label) client ───────────────────────────────────────────
  let parent = await prisma.deskClient.findFirst({ where: { name: { contains: 'vincere', mode: 'insensitive' }, parent: null } });
  if (!parent) {
    log(`+ white-label parent "${PARENT_NAME}" (not found, will create)`);
    if (APPLY) parent = await prisma.deskClient.create({ data: { name: PARENT_NAME, status: 'Ongoing', whiteLabel: true, createdBy: CREATED_BY, updatedBy: CREATED_BY } });
  } else if (!parent.whiteLabel) {
    log(`~ "${parent.name}" found; will mark it white label`);
    if (APPLY) parent = await prisma.deskClient.update({ where: { id: parent.id }, data: { whiteLabel: true, updatedBy: CREATED_BY } });
  } else {
    log(`= white-label parent "${parent.name}" already set up`);
  }

  const tally = { clients: 0, engagements: 0, cycles: 0, filled: 0 };

  async function ensureClient(name: string): Promise<{ id: string | null; existed: boolean }> {
    const existing = parent
      ? await prisma.deskClient.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, parent: parent.id } })
      : null;
    if (existing) return { id: existing.id, existed: true };
    tally.clients++;
    if (!APPLY || !parent) return { id: null, existed: false };
    const c = await prisma.deskClient.create({ data: { name, status: 'Ongoing', parent: parent.id, createdBy: CREATED_BY, updatedBy: CREATED_BY } });
    await prisma.deskAuditLog.create({ data: { action: 'record_created', actorEmail: 'import-vincere', board: 'clients', recordId: c.id, summary: c.name } });
    return { id: c.id, existed: false };
  }

  // ── Recurring end clients ─────────────────────────────────────────────────
  log();
  for (const r of ROWS) {
    const { id: clientId, existed } = await ensureClient(r.name);
    const existingEng = clientId ? await prisma.deskEngagement.findFirst({ where: { client: clientId, service: 'Managed Bookkeeping' } }) : null;
    let engId = existingEng?.id ?? null;

    if (!existingEng) {
      tally.engagements++;
      if (APPLY && clientId) {
        const e = await prisma.deskEngagement.create({
          data: {
            name: `${r.name} — Managed Bookkeeping`,
            client: clientId,
            service: 'Managed Bookkeeping',
            status: 'Active',
            frequency: r.delivery,
            bookkeeper,
            controller,
            start: `${START_MONTH}-01`,
            scope: `White label (${PARENT_NAME}). Priority ${r.priority}.`,
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
        ...(!existingEng.bookkeeper && bookkeeper ? { bookkeeper } : {}),
        ...(!existingEng.controller && controller ? { controller } : {}),
        ...(!existingEng.frequency ? { frequency: r.delivery } : {}),
      };
      if (Object.keys(fill).length) {
        tally.filled++;
        if (APPLY) await prisma.deskEngagement.update({ where: { id: existingEng.id }, data: { ...fill, updatedBy: CREATED_BY } });
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
        const name = `${r.name} — ${periodLabel(r.delivery, mk)}`;
        // The work board has September "Ready to Work", i.e. the month is closed and capture can start.
        const stage = mk < NOW_MONTH ? 'Capture' : 'Awaiting Close';
        const c = await prisma.deskCycle.create({ data: { name, engagement: engId, period, stage, slaDue: due, createdBy: CREATED_BY, updatedBy: CREATED_BY } });
        await prisma.deskAuditLog.create({ data: { action: 'record_created', actorEmail: 'import-vincere', board: 'cycles', recordId: c.id, summary: `${name} (import)` } });
      }
    }
    log(`${existed ? '=' : '+'} ${r.name.padEnd(34)} ${r.delivery.padEnd(10)} cycles: ${made.length ? made.join(', ') : 'none to add'}`);
  }

  // ── One-off clean-up ──────────────────────────────────────────────────────
  {
    const { id: clientId, existed } = await ensureClient(CLEANUP.name);
    const existingEng = clientId ? await prisma.deskEngagement.findFirst({ where: { client: clientId, service: 'Cleanup/Catch-up' } }) : null;
    if (!existingEng) {
      tally.engagements++;
      if (APPLY && clientId) {
        const e = await prisma.deskEngagement.create({
          data: {
            name: `${CLEANUP.name} — Clean-up`,
            client: clientId,
            service: 'Cleanup/Catch-up',
            status: 'Active',
            bookkeeper,
            controller,
            start: CLEANUP.start,
            scope: `Clean-up job we are doing for ${PARENT_NAME}. One-off, so no recurring cycles.`,
            createdBy: CREATED_BY,
            updatedBy: CREATED_BY,
          },
        });
        await prisma.deskAuditLog.create({ data: { action: 'record_created', actorEmail: 'import-vincere', board: 'engagements', recordId: e.id, summary: e.name } });
      }
    }
    log(`${existed ? '=' : '+'} ${CLEANUP.name.padEnd(34)} ${'Clean-up'.padEnd(10)} one-off, no recurring cycles`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log();
  log(
    `${APPLY ? 'Created' : 'Would create'}: ${tally.clients} end client(s), ${tally.engagements} engagement(s), ${tally.cycles} cycle(s)` +
      (tally.filled ? `; ${APPLY ? 'filled' : 'would fill'} blanks on ${tally.filled} existing engagement(s)` : '') +
      '.',
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
