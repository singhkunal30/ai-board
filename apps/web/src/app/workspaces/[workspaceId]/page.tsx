'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, uploadFile } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';
import type { Board, Workspace } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { Button, Input, Spinner } from '@/components/ui';

interface DocItem {
  id: string;
  filename: string;
  status: string;
  sizeBytes: number;
}

export default function WorkspaceBoardsPage() {
  const token = useRequireAuth();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string }[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const [ws, bs, tpls, ds] = await Promise.all([
      api<Workspace>(`/workspaces/${workspaceId}`),
      api<Board[]>(`/workspaces/${workspaceId}/boards`),
      api<{ id: string; name: string; description: string }[]>(`/templates`),
      api<DocItem[]>(`/workspaces/${workspaceId}/documents`),
    ]);
    setWorkspace(ws);
    setBoards(bs);
    setTemplates(tpls);
    setDocs(ds);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadFile(`/workspaces/${workspaceId}/documents`, file);
      e.target.value = '';
      // Reload now and again shortly, to reflect async processing status.
      await load();
      setTimeout(() => void load(), 2000);
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: string) {
    await api(`/workspaces/${workspaceId}/documents/${id}`, { method: 'DELETE' });
    await load();
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

        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Knowledge documents</h2>
            <label className="cursor-pointer rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              {uploading ? 'Uploading…' : 'Upload file'}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.md,.csv,.json,image/*"
                onChange={onUpload}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="mb-3 text-sm text-slate-500">
            Uploaded documents are parsed and embedded so board chat can answer from them.
          </p>
          {docs.length === 0 ? (
            <p className="text-slate-400">No documents yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium">{d.filename}</span>
                  <span className="flex items-center gap-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        d.status === 'READY'
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                          : d.status === 'FAILED'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {d.status}
                    </span>
                    <button
                      onClick={() => deleteDoc(d.id)}
                      className="text-slate-400 hover:text-red-500"
                      aria-label="Delete document"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
