import { NextResponse } from 'next/server';
import { loadAllDeskData } from '@/lib/desk/db';
import { myDay, type MyDayItem } from '@/desk/insights';
import { deliverDigestEmail } from '@/lib/desk/email';
import { deskBaseUrl } from '@/lib/desk/url';

// Vercel Cron hits this each morning. For every active desk user it builds their
// personal "My Day" and, when something actually needs them, emails a short
// digest to the address they were added with. Quiet days send nothing.
// Protected by CRON_SECRET: Vercel sends it as a Bearer token on cron requests.

export const dynamic = 'force-dynamic';

const line = (i: MyDayItem) => `${i.title} — ${i.sub}${i.chipText ? ` (${i.chipText})` : ''}`;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const data = await loadAllDeskData();
    const link = `${deskBaseUrl()}/desk/my-day`;
    let sent = 0;

    for (const u of data.users) {
      if (!u.isActive) continue;
      const d = myDay(data, { id: u.id, name: u.name, email: u.email });
      const groups = [
        { label: 'Due & overdue', items: d.dueAndOverdue.map(line) },
        { label: 'Waiting on you', items: d.waiting.map(line) },
        { label: 'Open queries', items: d.queries.map(line) },
        { label: 'Coming up this week', items: d.thisWeek.map(line) },
      ];
      if (!groups.some((g) => g.items.length)) continue; // nothing needs them today
      await deliverDigestEmail(u.email, { name: u.name || u.email, link, groups });
      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error('[cron/digest] failed', err);
    return NextResponse.json({ ok: false, error: 'digest failed' }, { status: 500 });
  }
}
