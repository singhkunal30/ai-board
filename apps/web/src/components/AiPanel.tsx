'use client';

import { useState } from 'react';
import type { BoardEdge, BoardObjectBase } from '@ai-board/shared';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Spinner } from './ui';

interface Fragment {
  objects: BoardObjectBase[];
  edges: BoardEdge[];
}
interface Task {
  title: string;
  priority: string;
  suggestedOwner?: string;
}

type Tab = 'generate' | 'analyze' | 'chat';

export function AiPanel({
  boardId,
  onFragment,
}: {
  boardId: string;
  onFragment: (objects: BoardObjectBase[], edges: BoardEdge[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>('generate');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function generate(kind: 'mindmap' | 'diagram') {
    if (!prompt.trim()) return;
    const frag = await run(kind, () =>
      api<Fragment>(`/boards/${boardId}/ai/${kind}`, { method: 'POST', body: { prompt } }),
    );
    if (frag) {
      onFragment(frag.objects, frag.edges);
      setPrompt('');
    }
  }

  async function cluster() {
    const res = await run('cluster', () =>
      api<{ fragment: Fragment }>(`/boards/${boardId}/ai/cluster`, { method: 'POST' }),
    );
    if (res) onFragment(res.fragment.objects, res.fragment.edges);
  }

  async function summarize() {
    const res = await run('summary', () => api<{ summary: string }>(`/boards/${boardId}/ai/summary`));
    if (res) setSummary(res.summary);
  }

  async function extractTasks() {
    const res = await run('tasks', () => api<{ tasks: Task[] }>(`/boards/${boardId}/ai/tasks`));
    if (res) setTasks(res.tasks);
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const message = chatInput;
    setChatInput('');
    setChatLog((l) => [...l, { role: 'user', content: message }]);
    const res = await run('chat', () =>
      api<{ answer: string }>(`/boards/${boardId}/ai/chat`, { method: 'POST', body: { message } }),
    );
    if (res) setChatLog((l) => [...l, { role: 'assistant', content: res.answer }]);
  }

  if (!open) {
    return (
      <Button
        className="absolute bottom-4 right-4 z-10 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        ✨ AI
      </Button>
    );
  }

  return (
    <aside className="absolute bottom-4 right-4 top-16 z-10 flex w-80 flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="font-semibold">✨ AI Assistant</span>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>

      <div className="flex border-b border-slate-200 text-sm dark:border-slate-800">
        {(['generate', 'analyze', 'chat'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 capitalize ${
              tab === t ? 'border-b-2 border-indigo-500 font-medium text-indigo-600' : 'text-slate-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {error && <p className="rounded bg-red-50 p-2 text-red-600 dark:bg-red-950">{error}</p>}

        {tab === 'generate' && (
          <>
            <Input
              placeholder="Describe what to create…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generate('mindmap')} disabled={!!busy}>
                {busy === 'mindmap' ? <Spinner /> : 'Mind map'}
              </Button>
              <Button onClick={() => generate('diagram')} disabled={!!busy}>
                {busy === 'diagram' ? <Spinner /> : 'Diagram'}
              </Button>
              <Button variant="ghost" onClick={cluster} disabled={!!busy}>
                {busy === 'cluster' ? <Spinner /> : 'Cluster notes'}
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Generated content is added to the canvas and shared live with collaborators.
            </p>
          </>
        )}

        {tab === 'analyze' && (
          <>
            <div className="flex gap-2">
              <Button onClick={summarize} disabled={!!busy}>
                {busy === 'summary' ? <Spinner /> : 'Summarize'}
              </Button>
              <Button variant="ghost" onClick={extractTasks} disabled={!!busy}>
                {busy === 'tasks' ? <Spinner /> : 'Extract tasks'}
              </Button>
            </div>
            {summary && (
              <div className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
                {summary}
              </div>
            )}
            {tasks && (
              <ul className="space-y-1">
                {tasks.length === 0 && <li className="text-slate-400">No tasks found.</li>}
                {tasks.map((t, i) => (
                  <li key={i} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                    <span className="font-medium">{t.title}</span>
                    <span className="ml-2 text-xs text-slate-400">{t.priority}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'chat' && (
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-2">
              {chatLog.length === 0 && (
                <p className="text-slate-400">Ask anything about this board.</p>
              )}
              {chatLog.map((m, i) => (
                <div
                  key={i}
                  className={`rounded p-2 text-xs ${
                    m.role === 'user'
                      ? 'bg-indigo-50 dark:bg-indigo-950'
                      : 'bg-slate-50 dark:bg-slate-800'
                  }`}
                >
                  <span className="whitespace-pre-wrap">{m.content}</span>
                </div>
              ))}
              {busy === 'chat' && <Spinner className="text-indigo-600" />}
            </div>
          </div>
        )}
      </div>

      {tab === 'chat' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendChat();
          }}
          className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-800"
        >
          <Input
            placeholder="Ask the board…"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <Button type="submit" disabled={!!busy}>
            Send
          </Button>
        </form>
      )}
    </aside>
  );
}
