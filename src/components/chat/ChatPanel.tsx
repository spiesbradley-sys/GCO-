'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/chat';

// Shared chat thread for the client portal and the desk. Checks for new messages
// every 10 seconds while open (which also marks them read), Enter sends,
// Shift+Enter adds a line. `side` decides which messages are "mine".

type Result = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };

const POLL_MS = 10_000;

function when(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel({
  initial,
  side,
  load,
  send,
  emptyText,
  placeholder,
  disabledReason,
}: {
  initial: ChatMessage[];
  side: 'client' | 'staff';
  load: () => Promise<Result>;
  send: (body: string) => Promise<Result>;
  emptyText: string;
  placeholder: string;
  /** When set, the composer is replaced by this note (e.g. no portal account yet). */
  disabledReason?: string | null;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load()
        .then((r) => r.ok && setMessages(r.messages))
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function submit() {
    const body = draft.trim();
    if (!body || pending) return;
    setError(null);
    start(async () => {
      const r = await send(body);
      if (!r.ok) return setError(r.error);
      setMessages(r.messages);
      setDraft('');
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-surface-card shadow-sm">
      <div className="flex max-h-[60vh] min-h-[280px] flex-col gap-3 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 ? (
          <p className="m-auto max-w-sm text-center text-[14px] text-ink-tertiary">{emptyText}</p>
        ) : (
          messages.map((m) => {
            const mine = side === 'client' ? m.fromClient : !m.fromClient;
            return (
              <div key={m.id} className={cn('flex max-w-[80%] flex-col gap-1', mine ? 'self-end items-end' : 'self-start items-start')}>
                <span className="text-[12px] text-ink-tertiary">
                  {m.authorName}
                  {!m.fromClient && side === 'client' ? ' · GCO Partners' : ''} · {when(m.createdAt)}
                </span>
                <p
                  className={cn(
                    'whitespace-pre-wrap break-words rounded-card px-4 py-2.5 text-[14.5px] leading-relaxed text-ink',
                    mine ? 'bg-surface-cream' : 'border border-border-subtle bg-surface-card',
                  )}
                >
                  {m.body}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border-subtle p-4">
        {disabledReason ? (
          <p className="text-[13px] text-ink-tertiary">{disabledReason}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor="chat-draft" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              maxLength={4000}
              placeholder={placeholder}
              className="w-full resize-y rounded-input border border-border-default bg-surface-card px-3 py-2 text-[15px] text-ink focus:border-accent-secondary focus:outline-none"
            />
            {error && (
              <p role="alert" className="text-[13px] text-unfavorable">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-ink-tertiary">Enter to send · Shift+Enter for a new line</span>
              <Button type="submit" loading={pending} disabled={!draft.trim()}>
                Send message
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
