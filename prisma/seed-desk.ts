import { PrismaClient, type DeskRole } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomBytes, createHash } from 'crypto';

// Idempotent desk seed + import. Bootstraps the owner (from DESK_OWNER_EMAIL) and
// imports docs/service-desk/gco-desk-seed.json into the desk boards. Money is
// converted from dollars to integer cents. Person names map to DeskUsers by name
// when present, else the field is left blank and reported.
const prisma = new PrismaClient();

const OWNER_EMAIL = (process.env.DESK_OWNER_EMAIL || 'spiesbradley@gmail.com').toLowerCase();
const MONEY: Record<string, string[]> = {
  clients: ['fee'],
  engagements: ['fee'],
  deals: ['fee'],
  pnl: ['revenue', 'delivery', 'commission', 'other'],
};
const PERSON: Record<string, string[]> = {
  engagements: ['controller', 'bookkeeper'],
  queries: ['owner'],
  deliverables: ['qc'],
  deals: ['owner', 'reviewer'],
};
const COLUMNS: Record<string, string[]> = {
  intake: ['name', 'email', 'accounting', 'payments', 'access', 'goodMonth', 'structure', 'clarity', 'buyJourney', 'monday', 'firstWin', 'tools', 'extra'],
  clients: ['name', 'status', 'legal', 'location', 'contact', 'email', 'onboarding', 'access', 'system', 'bank', 'letter', 'fee', 'start', 'streams', 'intake', 'notes'],
  engagements: ['name', 'client', 'service', 'status', 'fee', 'slaDelivery', 'slaMeeting', 'slaQuery', 'controller', 'bookkeeper', 'start', 'pilotEnd', 'scope', 'exclusions'],
  cycles: ['name', 'engagement', 'period', 'stage', 'capture', 'bkReview', 'ctrlReview', 'slaDue', 'slaStatus', 'delivered', 'meeting', 'notes'],
  queries: ['name', 'cycle', 'type', 'status', 'blocks', 'raised', 'responded', 'resolved', 'owner', 'details'],
  deliverables: ['name', 'cycle', 'type', 'delivered', 'qc', 'file', 'notes'],
  deals: ['name', 'stage', 'source', 'broker', 'posture', 'locations', 'fee', 'payment', 'review', 'owner', 'reviewer', 'entity', 'state', 'pms', 'periods', 'created', 'dataReceived', 'finalized', 'outstandings', 'learnings', 'notes'],
  pnl: ['name', 'party', 'month', 'service', 'revType', 'revenue', 'delivery', 'commission', 'other', 'status', 'recurring', 'start', 'notes'],
};

async function main() {
  console.log('Seeding GCO Service Desk…');

  // Owner bootstrap
  const owner = await prisma.deskUser.upsert({
    where: { email: OWNER_EMAIL },
    update: { role: 'owner', isActive: true },
    create: { email: OWNER_EMAIL, role: 'owner', name: 'GCO Owner' },
  });
  if (!owner.passwordHash) {
    const token = randomBytes(32).toString('base64url');
    await prisma.deskInvite.create({
      data: {
        email: OWNER_EMAIL,
        role: 'owner',
        tokenHash: createHash('sha256').update(token).digest('hex'),
        invitedByEmail: 'system',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });
    console.log(`\n  OWNER SET-PASSWORD LINK (valid 72h):`);
    console.log(`  http://localhost:3000/desk/set-password?kind=invite&token=${token}\n`);
  } else {
    console.log(`  Owner ${OWNER_EMAIL} already has a password.`);
  }

  // Load seed file
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'docs/service-desk/gco-desk-seed.json'), 'utf8')) as Record<string, Record<string, unknown>[]>;

  // Name → userId map (for person fields)
  const users = await prisma.deskUser.findMany({ select: { id: true, name: true } });
  const byName = new Map(users.filter((u) => u.name).map((u) => [u.name as string, u.id]));
  const unmapped = new Set<string>();

  const delegates: Record<string, { upsert: (args: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown> }> = {
    intake: prisma.deskIntake as never,
    clients: prisma.deskClient as never,
    engagements: prisma.deskEngagement as never,
    cycles: prisma.deskCycle as never,
    queries: prisma.deskQuery as never,
    deliverables: prisma.deskDeliverable as never,
    deals: prisma.deskDeal as never,
    pnl: prisma.deskPnlRow as never,
  };

  // Import order respects FKs.
  const ORDER = ['intake', 'clients', 'engagements', 'cycles', 'queries', 'deliverables', 'deals', 'pnl'] as const;
  const seedKeyFor: Record<string, string> = { pnl: 'pnl' };

  for (const board of ORDER) {
    const rows = raw[seedKeyFor[board] ?? board] ?? [];
    for (const src of rows) {
      const id = String(src.id);
      const data: Record<string, unknown> = {};
      for (const col of COLUMNS[board]) {
        if (!(col in src)) continue;
        let v = src[col];
        if (MONEY[board]?.includes(col) && v != null && v !== '') v = Math.round(Number(v) * 100);
        if (PERSON[board]?.includes(col) && typeof v === 'string' && v) {
          const uid = byName.get(v);
          if (uid) v = uid;
          else {
            unmapped.add(v);
            v = null;
          }
        }
        data[col] = v;
      }
      await delegates[board].upsert({ where: { id }, create: { id, ...data }, update: data });
    }
    console.log(`  ${board}: ${rows.length} rows`);
  }

  if (unmapped.size) {
    console.log(`\n  Person fields left blank (no matching desk user) — assign after inviting them:`);
    [...unmapped].forEach((n) => console.log(`    • ${n}`));
  }
  console.log('\nDesk seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
