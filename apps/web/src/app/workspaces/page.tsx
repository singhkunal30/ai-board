'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';
import type { Workspace } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { Button, Input, Spinner } from '@/components/ui';

export default function WorkspacesPage() {
  const token = useRequireAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setWorkspaces(await api<Workspace[]>('/workspaces'));
  }

  useEffect(() => {
    if (token) void load();
  }, [token]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api<Workspace>('/workspaces', { method: 'POST', body: { name } });
      setName('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Workspaces</h1>

        <form onSubmit={create} className="mb-8 flex gap-2">
          <Input placeholder="New workspace name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={creating}>
            {creating ? <Spinner /> : 'Create'}
          </Button>
        </form>

        {workspaces === null ? (
          <Spinner className="text-indigo-600" />
        ) : workspaces.length === 0 ? (
          <p className="text-slate-500">No workspaces yet. Create your first one above.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/workspaces/${w.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{w.name}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                      {w.role}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{w.slug}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
