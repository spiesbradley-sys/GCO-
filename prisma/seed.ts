import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Local-dev seed. Creates two client practices, a broker org, and a GCO internal
// org, plus users, memberships, and sample data across every module. All data is
// fake. The shared demo password is printed at the end.
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

async function main() {
  console.log('Seeding GCO Partners dev data…');

  // Clean slate (dev only). Analytics children first (FKs to Location/Provider).
  await prisma.transaction.deleteMany();
  await prisma.providerProduction.deleteMany();
  await prisma.locationMetric.deleteMany();
  await prisma.cashflowEntry.deleteMany();
  await prisma.arAgingSnapshot.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.location.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.document.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.engagement.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.practice.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── Orgs (tenants) ──
  const northside = await prisma.org.create({
    data: { name: 'Northside Dental', slug: 'northside-dental', type: 'practice' },
  });
  const lakeview = await prisma.org.create({
    data: { name: 'Lakeview Family Practice', slug: 'lakeview-family', type: 'practice' },
  });
  const brokerage = await prisma.org.create({
    data: { name: 'Meridian Deal Partners', slug: 'meridian-deals', type: 'broker' },
  });
  const gco = await prisma.org.create({
    data: { name: 'GCO Partners', slug: 'gco-internal', type: 'gco' },
  });

  // ── Users ──
  const owner = await prisma.user.create({
    data: { email: 'owner@northsidedental.com', name: 'Dana Okafor', role: 'client', passwordHash, emailVerified: new Date() },
  });
  const officeManager = await prisma.user.create({
    data: { email: 'manager@lakeview.com', name: 'Priya Nair', role: 'client', passwordHash, emailVerified: new Date() },
  });
  const accountant = await prisma.user.create({
    data: { email: 'accountant@firm.com', name: 'Marcus Bell', role: 'accountant', passwordHash, emailVerified: new Date() },
  });
  const broker = await prisma.user.create({
    data: { email: 'broker@meridian.com', name: 'Sofia Reyes', role: 'broker', passwordHash, emailVerified: new Date() },
  });
  const staff = await prisma.user.create({
    data: { email: 'staff@gcopartners.com', name: 'Alex Chen', role: 'gco_staff', passwordHash, emailVerified: new Date() },
  });

  // ── Memberships (drive the context switcher) ──
  await prisma.membership.createMany({
    data: [
      { userId: owner.id, orgId: northside.id, role: 'client' },
      { userId: officeManager.id, orgId: lakeview.id, role: 'client' },
      // Accountant serves both practices.
      { userId: accountant.id, orgId: northside.id, role: 'accountant' },
      { userId: accountant.id, orgId: lakeview.id, role: 'accountant' },
      { userId: broker.id, orgId: brokerage.id, role: 'broker' },
      // GCO staff can switch into every client org (and their own).
      { userId: staff.id, orgId: gco.id, role: 'gco_staff' },
      { userId: staff.id, orgId: northside.id, role: 'gco_staff' },
      { userId: staff.id, orgId: lakeview.id, role: 'gco_staff' },
      { userId: staff.id, orgId: brokerage.id, role: 'gco_staff' },
    ],
  });

  // ── Practices ──
  const northsidePractice = await prisma.practice.create({
    data: { orgId: northside.id, name: 'Northside Dental PC', entityType: 'Dental PC' },
  });
  const lakeviewPractice = await prisma.practice.create({
    data: { orgId: lakeview.id, name: 'Lakeview Family Practice LLC', entityType: 'Medical LLC' },
  });

  // ── Deals (broker) ──
  await prisma.deal.createMany({
    data: [
      { orgId: brokerage.id, name: 'Project Willow', targetName: 'Cedar Dental Group', stage: 'diligence' },
      { orgId: brokerage.id, name: 'Project Harbor', targetName: 'Bayside Orthodontics', stage: 'loi' },
    ],
  });

  // ── Engagements ──
  const eng1 = await prisma.engagement.create({
    data: { orgId: northside.id, practiceId: northsidePractice.id, name: 'Monthly close', status: 'active', startedAt: new Date() },
  });
  await prisma.engagement.create({
    data: { orgId: lakeview.id, practiceId: lakeviewPractice.id, name: 'Onboarding', status: 'onboarding' },
  });

  // ── Connections (status uses fixed semantics) ──
  await prisma.connection.createMany({
    data: [
      { orgId: northside.id, provider: 'quickbooks', status: 'connected', lastSyncAt: new Date(), metadata: { institution: 'QuickBooks Online' } },
      { orgId: northside.id, provider: 'plaid', status: 'needs_reauth', metadata: { institution: 'First National' } },
      { orgId: lakeview.id, provider: 'xero', status: 'connected', lastSyncAt: new Date() },
    ],
  });

  // ── Invoices + a payment ──
  const inv1 = await prisma.invoice.create({
    data: { orgId: northside.id, number: 'INV-1042', practiceId: northsidePractice.id, engagementId: eng1.id, amountCents: 185000, status: 'sent', dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) },
  });
  await prisma.invoice.create({
    data: { orgId: northside.id, number: 'INV-1041', practiceId: northsidePractice.id, amountCents: 185000, status: 'paid', issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
  });
  await prisma.invoice.create({
    data: { orgId: northside.id, number: 'INV-1039', practiceId: northsidePractice.id, amountCents: 92500, status: 'overdue', dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
  });
  await prisma.invoice.create({
    data: { orgId: lakeview.id, number: 'INV-2201', practiceId: lakeviewPractice.id, amountCents: 240000, status: 'sent', dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10) },
  });
  await prisma.payment.create({
    data: { orgId: northside.id, invoiceId: inv1.id, amountCents: inv1.amountCents, status: 'pending', stripeCheckoutSessionId: 'cs_test_seed_placeholder' },
  });

  // ── Threads + messages ──
  const thread = await prisma.thread.create({
    data: { orgId: northside.id, subject: 'March close — bank statements', practiceId: northsidePractice.id, engagementId: eng1.id },
  });
  await prisma.message.createMany({
    data: [
      { threadId: thread.id, senderId: staff.id, senderRole: 'gco_staff', body: 'Hi Dana — could you upload the March bank statements when you have a moment?', readAt: new Date() },
      { threadId: thread.id, senderId: owner.id, senderRole: 'client', body: 'Sure, uploading them now.', readAt: null },
    ],
  });

  // ── Documents ──
  await prisma.document.createMany({
    data: [
      { orgId: northside.id, name: 'March bank statement.pdf', type: 'Bank statement', period: '2026-03', uploadedById: owner.id, status: 'received', storageKey: `seed/${northside.id}/mar-bank.pdf`, sizeBytes: 482113, mimeType: 'application/pdf' },
      { orgId: northside.id, name: 'Feb P&L.pdf', type: 'P&L', period: '2026-02', uploadedById: staff.id, status: 'reconciled', storageKey: `seed/${northside.id}/feb-pl.pdf`, sizeBytes: 118220, mimeType: 'application/pdf' },
    ],
  });

  // ── Audit log ──
  await prisma.auditLog.createMany({
    data: [
      { orgId: northside.id, actorId: owner.id, action: 'login', target: owner.email },
      { orgId: northside.id, actorId: owner.id, action: 'document_upload', targetId: 'seed-doc' },
      { orgId: northside.id, actorId: staff.id, action: 'impersonation_start', target: 'Northside Dental' },
    ],
  });

  // ── Logic Dental Group (multi-location dental group → CFO dashboard) ──
  const logic = await prisma.org.create({
    data: { name: 'Logic Dental Group', slug: 'logic-dental', type: 'practice' },
  });

  const cfoOwner = await prisma.user.create({
    data: { email: 'cfo@logicdental.com', name: 'Morgan Diallo', role: 'client', passwordHash, emailVerified: new Date() },
  });
  await prisma.membership.createMany({
    data: [
      { userId: cfoOwner.id, orgId: logic.id, role: 'client' },
      { userId: accountant.id, orgId: logic.id, role: 'accountant' },
      { userId: staff.id, orgId: logic.id, role: 'gco_staff' },
    ],
  });

  const locations = await Promise.all(
    [
      ['Downtown', 'DT'],
      ['Riverside', 'RV'],
      ['Northgate', 'NG'],
      ['Lakeshore', 'LK'],
    ].map(([name, code]) =>
      prisma.location.create({ data: { orgId: logic.id, name: `Logic Dental — ${name}`, code } }),
    ),
  );

  await prisma.provider.createMany({
    data: [
      { orgId: logic.id, name: 'Dr. A. Mensah', specialty: 'General' },
      { orgId: logic.id, name: 'Dr. L. Petrova', specialty: 'Ortho' },
      { orgId: logic.id, name: 'Dr. R. Okonkwo', specialty: 'Endo' },
      { orgId: logic.id, name: 'Dr. S. Yamamoto', specialty: 'Perio' },
      { orgId: logic.id, name: 'Dr. J. Alvarez', specialty: 'General' },
    ],
  });

  // Open invoices spanning the AR aging buckets (age is relative to due date).
  const PAYERS = ['Delta Dental', 'Cigna', 'MetLife', 'Aetna', 'Self-pay'];
  const PATIENTS = ['J. Carter', 'M. Flores', 'K. Nguyen', 'B. Adeyemi', 'R. Costa', 'T. Walsh', 'P. Sato', 'L. Romero'];
  // offset days from now for dueDate → target bucket
  const AGES = [12, -8, -20, -44, -70, -85, -120, -160];
  let invNo = 3001;
  const dayMs = 86_400_000;
  for (let i = 0; i < 16; i++) {
    const loc = locations[i % locations.length];
    const ageOffset = AGES[i % AGES.length];
    const due = new Date(Date.now() + ageOffset * dayMs);
    const amount = 40_000 + ((i * 53) % 40) * 1000; // $400 – $830 range, cents below
    await prisma.invoice.create({
      data: {
        orgId: logic.id,
        number: `INV-${invNo++}`,
        amountCents: amount * 100,
        status: ageOffset < -1 ? 'overdue' : 'sent',
        issueDate: new Date(due.getTime() - 30 * dayMs),
        dueDate: due,
        locationId: loc.id,
        payer: PAYERS[i % PAYERS.length],
        patient: PATIENTS[i % PATIENTS.length],
      },
    });
  }

  await prisma.auditLog.create({
    data: { orgId: logic.id, actorId: staff.id, action: 'document_access', target: 'CFO dashboard' },
  });

  console.log('\nSeed complete. Sign in with any of these (password: %s):', DEMO_PASSWORD);
  console.log('  cfo@logicdental.com         — client (Logic Dental Group → CFO dashboard)');
  console.log('  owner@northsidedental.com   — client (Northside Dental)');
  console.log('  manager@lakeview.com        — client (Lakeview)');
  console.log('  accountant@firm.com         — accountant (both practices)');
  console.log('  broker@meridian.com         — broker (Meridian)');
  console.log('  staff@gcopartners.com       — GCO staff (all orgs, can impersonate)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
