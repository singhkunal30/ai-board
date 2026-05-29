'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';
import type { Board, Workspace } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { Button, Input, Spinner } from '@/components/ui';

export default function WorkspaceBoardsPage() {
  const token = useRequireAuth();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string }[]>([]);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const [creating, setCreating] = useState(false);

  async function load() {
    const [ws, bs, tpls] = await Promise.all([
      api<Workspace>(`/workspaces/${workspaceId}`),
      api<Board[]>(`/workspaces/${workspaceId}/boards`),
      api<{ id: string; name: string; description: string }[]>(`/templates`),
    ]);
    setWorkspace(ws);
    setBoards(bs);
    setTemplates(tpls);
  }

  useEffect(() => {
    if (token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, workspaceId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api<Board>(`/workspaces/${workspaceId}/boards`, {
        method: 'POST',
        body: { title, ...(templateId !== 'blank' ? { templateId } : {}) },
      });
      setTitle('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen">
      <TopBar title={workspace?.name ?? 'Workspace'} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Boards</h1>

        <form onSubmit={create} className="mb-8 flex flex-wrap gap-2">
          <Input
            placeholder="New board title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            title="Start from a template"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={creating}>
            {creating ? <Spinner /> : 'Create board'}
          </Button>
        </form>

        {boards === null ? (
          <Spinner className="text-indigo-600" />
        ) : boards.length === 0 ? (
          <p className="text-slate-500">No boards yet. Create one to start.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/boards/${b.id}`}
                  className="flex h-32 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="font-medium">{b.title}</span>
                  <span className="text-xs text-slate-400">
                    Updated {new Date(b.updatedAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
