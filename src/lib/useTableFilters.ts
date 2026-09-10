'use client';

import { useEffect, useState } from 'react';

// Persist last-used filters per table for the current session. Keyed by table id
// AND the active context so filters never leak across tenants. Uses
// sessionStorage (per-tab, cleared on close) — a lightweight convenience, wrapped
// in try/catch so a blocked store never breaks the page.
export function useTableFilters<T extends Record<string, unknown>>(
  tableId: string,
  contextKey: string,
  initial: T,
): [T, (patch: Partial<T>) => void, () => void] {
  const storageKey = `gco:filters:${tableId}:${contextKey}`;
  const [filters, setFilters] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setFilters({ ...initial, ...JSON.parse(raw) });
      else setFilters(initial);
    } catch {
      /* ignore */
    }
    // Re-read when the context changes so we don't carry one tenant's filters
    // into another.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const update = (patch: Partial<T>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const clear = () => {
    setFilters(initial);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  return [filters, update, clear];
}
