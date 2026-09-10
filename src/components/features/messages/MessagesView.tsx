'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { IconBell } from '@/components/ui/icons';
import { ROLE_LABELS } from '@/lib/rbac';
import type { Role } from '@prisma/client';
import { sendMessage } from '@/actions/messages';

export type MessageItem = {
  id: string;
  body: string;
  senderName: string;
  senderRole: Role;
  createdAt: string;
  isOwn: boolean;
};
export type ThreadItem = {
  id: string;
  subject: string;
  messages: MessageItem[];
  unread: number;
};

// Thread list + message view + composer. Polls for now (router.refresh on an
// interval); the server-action send path is the same one a websocket layer would
// call later — a clear extension point.
export function MessagesView({ threads }: { threads: ThreadItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [activeId, setActiveId] = useState(threads[0]?.id ?? null);
  const [draft, setDraft] = useState('');
  const [pending, start] = useTransition();

  // Polling extension point — swap for a subscription later.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [router]);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={<IconBell width={22} height={22} />}
        title="No messages yet"
        body="Start a thread with your GCO team and it will appear here."
      />
    );
  }

  function send() {
    if (!active || !draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    start(async () => {
      const res = await sendMessage({ threadId: active.id, body });
      if (res.ok) router.refresh();
      else {
        toast.error(res.error ?? 'Could not send message.');
        setDraft(body);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      {/* Thread list */}
      <ul className="flex flex-col gap-1 rounded-card border border-border-subtle bg-surface-card p-2">
        {threads.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => setActiveId(t.id)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-input px-3 py-2.5 text-left transition-colors duration-fast ease-standard',
                active?.id === t.id ? 'bg-surface-cream' : 'hover:bg-surface-sunken',
              )}
            >
              <span className="truncate text-[14px] font-semibold text-ink">{t.subject}</span>
              {t.unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent-primary px-1.5 text-[11px] font-semibold text-white">
                  {t.unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Message view + composer */}
      <div className="flex min-h-[420px] flex-col rounded-card border border-border-subtle bg-surface-card">
        <div className="border-b border-border-subtle px-5 py-3">
          <h3 className="font-heading text-card-title">{active?.subject}</h3>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          {active?.messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex flex-col gap-1', m.isOwn ? 'items-end' : 'items-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-card px-4 py-2.5 text-[14px]',
                  m.isOwn ? 'bg-surface-cream text-ink' : 'bg-surface-sunken text-ink',
                )}
              >
                {m.body}
              </div>
              <span className="text-[12px] text-ink-tertiary">
                {m.senderName} · {ROLE_LABELS[m.senderRole]} · {m.createdAt}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2 border-t border-border-subtle p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Write a message"
            aria-label="Message"
            className="flex-1 resize-none rounded-input border border-border-default bg-surface-card px-3 py-2 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none focus-visible:border-accent-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary"
          />
          <Button onClick={send} loading={pending} disabled={!draft.trim()}>
            Send message
          </Button>
        </div>
      </div>
    </div>
  );
}
