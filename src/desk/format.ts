import type { ChipColor } from './boards';

// Money is stored in integer cents. Display and parse helpers for the desk.
export function money(cents: number | null | undefined): string {
  if (cents == null || (cents as unknown) === '' || isNaN(Number(cents))) return '';
  const v = Number(cents) / 100;
  return (
    '$' +
    v.toLocaleString('en-US', {
      minimumFractionDigits: v % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** Parse a dollar input (number or string) to integer cents. */
export function dollarsToCents(input: unknown): number | null {
  if (input == null || input === '') return null;
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[,$\s]/g, ''));
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

export function centsToDollars(cents: number | null | undefined): number | null {
  if (cents == null || (cents as unknown) === '') return null;
  return Number(cents) / 100;
}

/** Fixed desk date format: 12 Mar 2026. Dates are stored as 'YYYY-MM-DD'. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const x = new Date(d + 'T00:00:00');
  return isNaN(x.getTime())
    ? String(d)
    : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// GCO-branded chip tones. The reference uses a rainbow; the house style keeps to
// the fixed data semantics plus neutral, so we collapse colors into warm tones:
// green → favorable (teal), red → unfavorable (rust), yellow/orange → watch
// (gold), everything else → neutral.
export type ChipTone = 'favorable' | 'unfavorable' | 'watch' | 'neutral';

export function chipTone(color: ChipColor): ChipTone {
  switch (color) {
    case 'green':
      return 'favorable';
    case 'red':
      return 'unfavorable';
    case 'yellow':
    case 'orange':
      return 'watch';
    default:
      return 'neutral';
  }
}

export const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  favorable: 'bg-favorable-tint text-favorable',
  unfavorable: 'bg-unfavorable-tint text-unfavorable',
  watch: 'bg-watch-tint text-watch',
  neutral: 'bg-surface-sunken text-ink-secondary',
};
