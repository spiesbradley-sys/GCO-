import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDeskUser } from '@/lib/desk/auth';
import { canTouchRecord } from '@/lib/desk/db';
import { recordDeskAudit } from '@/lib/desk/audit';
import { readWorkbook } from '@/desk/financials/readWorkbook';
import { parseFinancials } from '@/desk/financials/parse';
import type { FinancialsData } from '@/desk/financials/types';
import type { DeskRole } from '@/desk/roles';

// Upload (POST) and inspect (GET) the management-financials workbook for a cycle.
// A route handler rather than a server action so the workbook isn't held to the
// 1 MB server-action body limit. Same access rule as editing the cycle: anyone who
// can see the cycle on the desk (accountants only their assigned engagements).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

async function guard(cycleId: string) {
  const me = await getDeskUser();
  if (!me) return { error: NextResponse.json({ error: 'Sign in to the desk first.' }, { status: 401 }) };
  const cycle = await prisma.deskCycle.findUnique({ where: { id: cycleId }, select: { id: true, name: true } });
  // Same response for "missing" and "not yours" so ids can't be probed.
  if (!cycle || !(await canTouchRecord({ id: me.id, role: me.role as DeskRole }, 'cycles', cycleId)))
    return { error: NextResponse.json({ error: 'Cycle not found.' }, { status: 404 }) };
  return { me, cycle };
}

function summarize(row: { id: string; fileName: string; sizeBytes: number; createdAt: Date; warnings: string[]; data: unknown; uploadedBy: string | null }) {
  const d = row.data as FinancialsData;
  return {
    id: row.id,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.createdAt.toISOString(),
    uploadedBy: row.uploadedBy,
    warnings: row.warnings,
    entity: d.entity,
    periodLabel: d.periodLabel,
    netRevenue: d.kpis.netRevenue,
    netIncome: d.kpis.netIncome,
  };
}

export type FinancialsSummary = ReturnType<typeof summarize>;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard(params.id);
  if ('error' in g) return g.error;
  const latest = await prisma.deskFinancials.findFirst({ where: { cycle: params.id }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ latest: latest ? summarize(latest) : null });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guard(params.id);
  if ('error' in g) return g.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a workbook to upload.' }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name))
    return NextResponse.json({ error: 'That file isn’t an .xlsx workbook. Save it as Excel Workbook (.xlsx) and try again.' }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: 'That workbook is over 10 MB. Remove the GL tab’s extra columns or images and try again.' }, { status: 400 });

  let parsed;
  try {
    const { grids, formulasWithoutResult } = await readWorkbook(await file.arrayBuffer());
    parsed = parseFinancials(grids);
    if (formulasWithoutResult > 0)
      parsed.warnings.push(
        `${formulasWithoutResult} formula cells had no saved value and were read as $0. Open and save the book in Excel before uploading if any total looks wrong.`,
      );
  } catch (err) {
    console.error('[financials] parse failed', err);
    return NextResponse.json({ error: 'We couldn’t read that workbook. Check it opens in Excel, then upload it again.' }, { status: 400 });
  }

  const { data, warnings } = parsed;
  if (data.kpis.netRevenue === null && data.months.length === 0)
    return NextResponse.json(
      { error: 'This doesn’t look like the GCO monthly financials book (no Overview KPIs or P&L - Monthly tab found).' },
      { status: 400 },
    );

  const row = await prisma.deskFinancials.create({
    data: {
      cycle: params.id,
      fileName: file.name.slice(0, 255),
      sizeBytes: file.size,
      data: data as never,
      warnings,
      uploadedBy: g.me.id,
    },
  });

  await recordDeskAudit({
    action: 'financials.upload',
    actorId: g.me.id,
    actorEmail: g.me.email,
    board: 'cycles',
    recordId: params.id,
    summary: `Uploaded financials (${data.periodLabel ?? 'period unknown'}) to ${g.cycle.name}`,
  });

  return NextResponse.json({ latest: summarize(row) });
}
