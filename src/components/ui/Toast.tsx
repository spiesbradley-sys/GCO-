'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconClose } from './icons';

// Toasts confirm; they never carry validation errors and never carry something
// the user MUST act on. Bottom-right, 4px status bar on the LEFT inner edge.
// Success auto-dismisses at 4s; errors persist. One at a time — the rest queue.

type ToastTone = 'success' | 'error' | 'warning' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };

const barColor: Record<ToastTone, string> = {
  success: 'bg-favorable',
  error: 'bg-accent-alert',
  warning: 'bg-watch',
  info: 'bg-ink',
};

type ToastApi = {
  success: (m: string) => void;
  error: (m: string) => void;
  warning: (m: string) => void;
  info: (m: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setQueue((q) => [...q, { id, tone, message }]);
      if (tone === 'success' || tone === 'info') {
        setTimeout(() => dismiss(id), 4000);
      }
    },
    [dismiss],
  );

  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    warning: (m) => push('warning', m),
    info: (m) => push('info', m),
  };

  // One at a time; the rest queue behind it.
  const current = queue[0];

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-[420px] flex-col gap-2"
        aria-live="polite"
        role="status"
      >
        {current && (
          <div className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-card bg-surface-card py-3 pl-4 pr-3 shadow-md">
            <span className={cn('absolute left-0 top-0 h-full w-1', barColor[current.tone])} />
            <p className="flex-1 pl-2 text-[14px] text-ink">{current.message}</p>
            <button
              onClick={() => dismiss(current.id)}
              aria-label="Dismiss"
              className="rounded-full p-1 text-ink-tertiary hover:bg-surface-sunken"
            >
              <IconClose width={14} height={14} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
