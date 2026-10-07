// Client-safe calc enrichment (used by the server data layer AND the drawer).
import { margin, marginPct, queryAge, openBlockers, rack, dealClock, todayISO, type Rec } from './compute';
import { BOARDS } from './boards';
import { money } from './format';
import type { BoardKey } from './roles';

export function enrichRecord(board: BoardKey, r: Rec, ctx: { queries: Rec[] }): Rec {
  const today = todayISO();
  const calcs: Rec = {};
  for (const f of BOARDS[board].fields) {
    if (f.t !== 'calc') continue;
    switch (f.calc) {
      case 'blockers':
        calcs.blockers = openBlockers(ctx.queries, r.id as string).length;
        break;
      case 'queryAge':
        calcs.age = queryAge(r, today);
        break;
      case 'margin':
        calcs.margin = margin(r);
        break;
      case 'marginPct':
        calcs.marginPct = marginPct(r);
        break;
      case 'rack': {
        const x = rack(r.locations as number);
        calcs.rack = x ? `${money(x.feeCents)} · ${x.days} BD` : '';
        break;
      }
      case 'dealClock':
        calcs.clock = dealClock(r);
        break;
    }
  }
  return { ...r, ...calcs };
}

export function enrichRows(board: BoardKey, rows: Rec[], ctx: { queries: Rec[] }): Rec[] {
  return rows.map((r) => enrichRecord(board, r, ctx));
}
