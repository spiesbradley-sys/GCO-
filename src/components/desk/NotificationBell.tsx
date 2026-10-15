'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { IconBell } from '@/components/ui/icons';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDTO,
} from '@/desk/actions/notifications';

const POLL_MS = 60_000;

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Notification centre: bell with unread count and a panel of recent items.
 * Clicking an item marks it read and opens the row it is about. */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const wrap = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await listNotifications();
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, []);

  // Keep the badge fresh without a page reload.
  useEffect(() => {
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    load();
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, load]);

  async function openItem(n: NotificationDTO) {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead({ id: n.id }).catch(() => {});
    }
    // Client chat messages open the conversation inside that client's portal view.
    router.push(
      n.kind === 'chat'
        ? `/desk/clients/${encodeURIComponent(n.recordId)}/portal/messages`
        : `/desk/boards/${n.board}?open=${encodeURIComponent(n.recordId)}`,
    );
  }

  async function readAll() {
    setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? prev);
    setUnread(0);
    markAllNotificationsRead().catch(() => {});
  }

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-sunken"
      >
        <IconBell width={18} height={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent-primary px-1 font-numeric text-[10.5px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-[60] overflow-hidden rounded-card border border-border-subtle bg-surface-card shadow-lg md:inset-x-auto md:left-[15.5rem] md:top-4 md:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <p className="font-heading text-[15px] font-bold text-ink">Notifications</p>
            <button onClick={readAll} disabled={unread === 0} className="text-[12.5px] font-semibold text-accent-secondary disabled:text-ink-tertiary">
              Mark all read
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {items === null && <p className="px-4 py-6 text-[13px] text-ink-tertiary">Loading…</p>}
            {items?.length === 0 && <p className="px-4 py-6 text-[13px] text-ink-tertiary">You&rsquo;re all caught up. New comments on rows will show up here.</p>}
            {items?.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={cn('flex w-full gap-3 border-b border-border-subtle px-4 py-3 text-left last:border-b-0 hover:bg-surface-sunken', !n.read && 'bg-surface-cream')}
              >
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent-primary')} aria-label={n.read ? undefined : 'Unread'} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13.5px] text-ink', !n.read && 'font-semibold')}>{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-ink-secondary">{n.body}</span>
                  <span className="mt-1 block text-[11.5px] text-ink-tertiary">{ago(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
