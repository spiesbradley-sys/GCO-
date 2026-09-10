import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Currency from integer cents. Full precision (tooltips, cells). */
export function formatCurrency(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** Currency without cents — cleaner for large headline figures ($1,284,245). */
export function formatCurrencyWhole(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Abbreviated currency for chart axes: $1.2M, $840K. */
export function formatCurrencyAbbrev(cents: number, currency = 'usd'): string {
  const value = cents / 100;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const symbol = currency.toUpperCase() === 'USD' ? '$' : '';
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${Math.round(abs / 1_000)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

/** Fixed table date format: 12 Mar 2026. */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function initials(name?: string | null, email?: string | null): string {
  const source = (name ?? email ?? '?').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
