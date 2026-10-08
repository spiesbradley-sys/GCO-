'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { listComments, addComment, deleteComment, type CommentDTO } from '@/desk/actions/comments';
import type { BoardKey, DeskRole } from '@/desk/roles';

type Person = { id: string; name: string | null; email: string };

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Per-row discussion thread. Posting emails the owner, controllers and the
 * accountants who can see the row (see notifyTeam in the comments action). */
export function Discussion({ board, recordId, users, role }: { board: BoardKey; recordId: string; users: Person[]; role: DeskRole }) {
  const toast = useToast();
  const [comments, setComments] = useState<CommentDTO[] | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    setComments(null);
    listComments({ board, id: recordId })
      .then((res) => {
        if (!live) return;
        if (res.ok) {
          setComments(res.comments);
          setViewerId(res.viewerId);
        } else {
          setComments([]);
          toast.error(res.error);
        }
      })
      .catch(() => {
        if (live) setComments([]);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, recordId]);

  const nameOf = (c: CommentDTO) => {
    const u = users.find((x) => x.id === c.authorId);
    return u?.name ?? u?.email ?? c.authorEmail;
  };

  function post() {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      try {
        const res = await addComment({ board, id: recordId, body });
        if (res.ok) {
          setComments((prev) => [...(prev ?? []), res.comment]);
          setViewerId(res.comment.authorId);
          setDraft('');
        } else toast.error(res.error);
      } catch {
        toast.error('Could not post your comment. Try again.');
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const res = await deleteComment({ commentId: id });
        if (res.ok) setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
        else toast.error(res.error);
      } catch {
        toast.error('Could not delete that comment. Try again.');
      }
    });
  }

  return (
    <section aria-label="Discussion" className="flex flex-col gap-3 border-t border-border-subtle pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-header text-ink-tertiary">
        Discussion{comments ? ` · ${comments.length}` : ''}
      </p>

      {comments === null && <p className="text-[13px] text-ink-tertiary">Loading…</p>}
      {comments?.length === 0 && <p className="text-[13px] text-ink-tertiary">No comments yet. Owners, controllers and accountants are notified when you post.</p>}

      <ul className="flex flex-col gap-3">
        {(comments ?? []).map((c) => (
          <li key={c.id} className="rounded-input bg-surface-sunken px-3 py-2">
            <div className="flex items-baseline gap-2 text-[12px] text-ink-tertiary">
              <span className="font-semibold text-ink">{nameOf(c)}</span>
              <span className="tnum">{when(c.createdAt)}</span>
              {(c.authorId === viewerId || role === 'owner') && (
                <button onClick={() => remove(c.id)} disabled={pending} className="ml-auto text-[12px] text-ink-tertiary hover:text-ink">
                  Delete
                </button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{c.body}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <label htmlFor="discussion-draft" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="discussion-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') post();
          }}
          rows={2}
          maxLength={4000}
          placeholder="Add a comment…"
          className="w-full min-h-[60px] resize-y rounded-input border border-transparent bg-surface-sunken px-2 py-1.5 text-[14px] leading-relaxed text-ink hover:border-border-subtle focus:border-accent-secondary focus:bg-surface-card focus:outline-none"
        />
        <div className="flex items-center justify-end gap-2">
          <span className="text-[11.5px] text-ink-tertiary">Ctrl+Enter to post</span>
          <Button size="sm" onClick={post} disabled={pending || !draft.trim()}>
            Post
          </Button>
        </div>
      </div>
    </section>
  );
}
