'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconClose, IconChevronRight } from './icons';

// Right-side drawer for detail-in-context (a transaction, a document, a deal
// record). Page stays visible behind a warm scrim. Same chrome as a modal.
// Optional eyebrow (rendered above the title) and onBack (a back affordance for
// in-place drill navigation — a second drill opens in place of the first).
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  onBack,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'flex h-full w-full flex-col bg-surface-card shadow-lg outline-none transition-transform duration-slow ease-standard',
          width === 'lg' ? 'max-w-[640px]' : 'max-w-[480px]',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-6 py-4">
          <div className="flex min-w-0 items-start gap-2">
            {onBack && (
              <button
                onClick={onBack}
                aria-label="Back"
                className="mt-0.5 rotate-180 rounded-full p-1 text-ink-tertiary hover:bg-surface-sunken"
              >
                <IconChevronRight width={18} height={18} />
              </button>
            )}
            <div className="flex min-w-0 flex-col">
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              <h2 className="truncate font-heading text-[18px] font-bold text-ink">{title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-tertiary hover:bg-surface-sunken"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
