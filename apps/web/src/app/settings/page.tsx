'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';
import { TopBar } from '@/components/TopBar';
import { Button, Input, Spinner } from '@/components/ui';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const token = useRequireAuth();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  async function load() {
    setKeys(await api<ApiKey[]>('/api-keys'));
  }
  useEffect(() => {
    if (token) void load();
  }, [token]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api<{ token: string }>('/api-keys', { method: 'POST', body: { name: name.trim() } });
      setNewToken(res.token);
      setName('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    await api(`/api-keys/${id}`, { method: 'DELETE' });
    await load();
  }

  if (!token) return null;

  return (
    <div className="min-h-screen">
      <TopBar title="Settings" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold">API keys</h1>
        <p className="mb-6 text-sm text-slate-500">
          Personal access tokens for non-interactive clients — the{' '}
          <span className="font-medium">MCP server</span> (Claude Code / Desktop), CI, and integrations.
          A token carries your permissions; treat it like a password.
        </p>

        {newToken && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
              Copy your new token now — it won’t be shown again.
            </p>
            <code className="block break-all rounded bg-white px-3 py-2 text-xs dark:bg-slate-900">{newToken}</code>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => navigator.clipboard?.writeText(newToken)}>Copy</Button>
              <Button variant="ghost" onClick={() => setNewToken(null)}>Dismiss</Button>
            </div>
          </div>
        )}

        <form onSubmit={create} className="mb-8 flex gap-2">
          <Input placeholder="Key name (e.g. Claude Code)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={creating}>
            {creating ? <Spinner /> : 'Create key'}
          </Button>
        </form>

        {keys === null ? (
          <Spinner className="text-indigo-600" />
        ) : keys.length === 0 ? (
          <p className="text-slate-400">No API keys yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{k.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">aib_{k.prefix}…</span>
                  {k.revokedAt && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">revoked</span>}
                  <div className="text-xs text-slate-400">
                    {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleString()}` : 'Never used'}
                  </div>
                </div>
                {!k.revokedAt && (
                  <button onClick={() => revoke(k.id)} className="text-red-500 hover:underline">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-xs text-slate-400">
          Connect Claude Code: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">claude mcp add ai-board --env AI_BOARD_URL=… --env AI_BOARD_API_KEY=… -- node apps/mcp/dist/index.js</code>
        </p>
      </main>
    </div>
  );
}
