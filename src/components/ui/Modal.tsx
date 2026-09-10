'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconClose } from './icons';

// Focused decision / short form. Centered, warm scrim (not blur), 12px radius,
// shadow-lg. Escape and scrim click close; focus returns to the trigger. Never
// stack modals. Becomes a full-screen sheet under 640px.

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'default' | 'form';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 max-[640px]:items-end max-[640px]:p-0"
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
          'flex max-h-[90vh] w-full flex-col rounded-card bg-surface-card shadow-lg outline-none',
          size === 'form' ? 'max-w-modal-form' : 'max-w-modal',
          'max-[640px]:h-full max-[640px]:max-h-full max-[640px]:rounded-none',
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <h2 className="font-heading text-[18px] font-bold text-ink">{title}</h2>
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
          <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4 max-[640px]:sticky max-[640px]:bottom-0 max-[640px]:bg-surface-card">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
