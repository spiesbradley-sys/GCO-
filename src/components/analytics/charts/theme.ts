// House chart palette + axis formatters. Recharts takes color values as props, so
// these hexes mirror the design tokens (the one place raw values are handed to a
// JS lib — §9 of the house style lists the same series order). Keep them in sync
// with src/styles/tokens.css.

export const SERIES = ['#12898d', '#9c7804', '#c1502e', '#6f5a22', '#52b0b3', '#c9a769'] as const;

export const CHART = {
  ink: '#251c1a',
  favorable: '#12898d',
  unfavorable: '#c0531d',
  watch: '#9c7d33',
  gridline: '#e0ddd9', // border-subtle
  axisDash: '#b6b3b2', // border-default (budget line)
  axisText: '#6f6a62', // text-tertiary
  card: '#ffffff',
} as const;

/** Abbreviated currency for axes: $1.2M, $840K. */
export function axisCurrency(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function axisPercent(v: number): string {
  return `${Math.round(v * 100)}%`;
}
