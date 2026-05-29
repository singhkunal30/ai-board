'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button, Input, Spinner } from './ui';

interface Comment {
  id: string;
  body: string;
  resolvedAt: string | null;
  createdAt: string;
  author: { id: string; name: string };
}

export function CommentsPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const userId = useAuthStore((s) => s.user?.id);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setComments(await api<Comment[]>(`/boards/${boardId}/comments`));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api(`/boards/${boardId}/comments`, { method: 'POST', body: { body } });
      setBody('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleResolved(c: Comment) {
    await api(`/boards/${boardId}/comments/${c.id}`, {
      method: 'PATCH',
      body: { resolved: !c.resolvedAt },
    });
    await load();
  }

  async function remove(id: string) {
    await api(`/boards/${boardId}/comments/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <aside className="absolute bottom-4 left-3 top-16 z-10 flex w-72 flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="font-semibold">💬 Comments</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {comments === null ? (
          <Spinner className="text-indigo-600" />
        ) : comments.length === 0 ? (
          <p className="text-slate-400">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`rounded border p-2 ${
                c.resolvedAt
                  ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium text-slate-600 dark:text-slate-300">{c.author.name}</span>
                <span>{new Date(c.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              <div className="mt-1 flex gap-3 text-xs">
                <button onClick={() => toggleResolved(c)} className="text-indigo-600 hover:underline">
                  {c.resolvedAt ? 'Reopen' : 'Resolve'}
                </button>
                {c.author.id === userId && (
                  <button onClick={() => remove(c.id)} className="text-red-500 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={add} className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-800">
        <Input placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : 'Post'}
        </Button>
      </form>
    </aside>
  );
}
