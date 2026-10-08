import { NextResponse } from 'next/server';
import { ensureMonthlyCycles } from '@/lib/desk/cycles';

// Vercel Cron hits this daily; it ensures the current month's cycle exists for
// every live managed engagement (idempotent — creates nothing if already there).
// Protected by CRON_SECRET: Vercel sends it as a Bearer token on cron requests.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const created = await ensureMonthlyCycles({ id: 'system', email: 'auto@desk' });
    return NextResponse.json({ ok: true, created: created.length, cycles: created });
  } catch (err) {
    console.error('[cron/cycles] failed', err);
    return NextResponse.json({ ok: false, error: 'generation failed' }, { status: 500 });
  }
}
