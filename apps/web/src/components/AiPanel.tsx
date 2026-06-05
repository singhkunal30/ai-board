'use client';

import { useState } from 'react';
import type { AppliedBoardOp, BoardEdge, BoardObjectBase } from '@ai-board/shared';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Spinner } from './ui';

interface Fragment {
  objects: BoardObjectBase[];
  edges: BoardEdge[];
}
interface CommandResult {
  reply: string;
  operations: AppliedBoardOp[];
}
interface Task {
  title: string;
  priority: string;
  suggestedOwner?: string;
}
interface AgentResult {
  kind: string;
  text?: string;
  fragment?: Fragment;
  data?: unknown;
}

type Tab = 'agent' | 'create' | 'agents' | 'analyze' | 'chat';

const AGENTS: { kind: string; label: string }[] = [
  { kind: 'product_manager', label: 'Product Manager' },
  { kind: 'architect', label: 'Architect' },
  { kind: 'scrum', label: 'Scrum Master' },
  { kind: 'research', label: 'Research' },
];

export function AiPanel({
  boardId,
  onFragment,
  onOps,
}: {
  boardId: string;
  onFragment: (objects: BoardObjectBase[], edges: BoardEdge[]) => void;
  onOps: (operations: AppliedBoardOp[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>('agent');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [command, setCommand] = useState('');
  const [agentLog, setAgentLog] = useState<
    { role: 'user' | 'assistant'; content: string }[]
  >([]);
  const [prompt, setPrompt] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentText, setAgentText] = useState<string | null>(null);
  const [meetingNotes, setMeetingNotes] = useState('');
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

  const place = (f?: Fragment) => f && onFragment(f.objects, f.edges);

  async function sendCommand() {
    if (!command.trim()) return;
    const instruction = command;
    setCommand('');
    setAgentLog((l) => [...l, { role: 'user', content: instruction }]);
    const history = agentLog.slice(-6);
    const res = await run('command', () =>
      api<CommandResult>(`/boards/${boardId}/ai/command`, {
        method: 'POST',
        body: { instruction, history },
      }),
    );
    if (res) {
      onOps(res.operations);
      const count = res.operations.length;
      setAgentLog((l) => [
        ...l,
        { role: 'assistant', content: `${res.reply}${count ? ` (${count} change${count > 1 ? 's' : ''})` : ''}` },
      ]);
    }
  }

  async function generate(kind: 'mindmap' | 'diagram') {
    if (!prompt.trim()) return;
    const frag = await run(kind, () =>
      api<Fragment>(`/boards/${boardId}/ai/${kind}`, { method: 'POST', body: { prompt } }),
    );
    if (frag) {
      place(frag);
      setPrompt('');
    }
  }

  async function cluster() {
    const res = await run('cluster', () =>
      api<{ fragment: Fragment }>(`/boards/${boardId}/ai/cluster`, { method: 'POST' }),
    );
    if (res) place(res.fragment);
  }

  async function knowledgeGraph() {
    const res = await run('kg', () =>
      api<Fragment>(`/boards/${boardId}/ai/knowledge-graph`, { method: 'POST' }),
    );
    if (res) place(res);
  }

  async function runAgent(kind: string) {
    if (!agentPrompt.trim() && kind !== 'research') return;
    setAgentText(null);
    const res = await run(kind, () =>
      api<AgentResult>(`/boards/${boardId}/ai/agents/${kind}`, {
        method: 'POST',
        body: { prompt: agentPrompt || 'Review this board' },
      }),
    );
    if (res) {
      place(res.fragment);
      if (res.text) setAgentText(res.text);
    }
  }

  async function onVisionFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    e.target.value = '';
    const res = await run('vision', () =>
      api<{ analysis: string; fragment: Fragment }>(`/boards/${boardId}/ai/vision`, {
        method: 'POST',
        body: { imageBase64: dataUrl },
      }),
    );
    if (res) {
      place(res.fragment);
      setSummary(res.analysis);
    }
  }

  async function processMeeting() {
    if (meetingNotes.trim().length < 10) return;
    const res = await run('meeting', () =>
      api<{ fragment: Fragment }>(`/boards/${boardId}/ai/meeting`, {
        method: 'POST',
        body: { notes: meetingNotes },
      }),
    );
    if (res) {
      place(res.fragment);
      setMeetingNotes('');
    }
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
      <Button className="absolute bottom-4 right-4 z-10 rounded-full shadow-lg" onClick={() => setOpen(true)}>
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

      <div className="flex border-b border-slate-200 text-xs dark:border-slate-800">
        {(['agent', 'create', 'agents', 'analyze', 'chat'] as Tab[]).map((t) => (
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

        {tab === 'agent' && (
          <div className="space-y-2">
            {agentLog.length === 0 && (
              <p className="text-slate-400">
                Tell the assistant what to change — e.g. “add three sticky notes about
                onboarding”, “connect Login to Database”, “delete the empty notes”, or
                “rename the central node to Q3 Goals”. It edits the board for you.
              </p>
            )}
            {agentLog.map((m, i) => (
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
            {busy === 'command' && <Spinner className="text-indigo-600" />}
          </div>
        )}

        {tab === 'create' && (
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
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={cluster} disabled={!!busy}>
                {busy === 'cluster' ? <Spinner /> : 'Cluster notes'}
              </Button>
              <Button variant="ghost" onClick={knowledgeGraph} disabled={!!busy}>
                {busy === 'kg' ? <Spinner /> : 'Knowledge graph'}
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Results are added to the canvas and shared live with collaborators.
            </p>
          </>
        )}

        {tab === 'agents' && (
          <>
            <Input
              placeholder="Brief for the agent…"
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              {AGENTS.map((a) => (
                <Button key={a.kind} variant="ghost" onClick={() => runAgent(a.kind)} disabled={!!busy}>
                  {busy === a.kind ? <Spinner /> : a.label}
                </Button>
              ))}
            </div>
            {agentText && (
              <div className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
                {agentText}
              </div>
            )}
            <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
              <label className="mb-1 block text-xs font-medium text-slate-500">Meeting notes</label>
              <textarea
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                placeholder="Paste raw meeting notes…"
                className="h-24 w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
              />
              <Button className="mt-2 w-full" onClick={processMeeting} disabled={!!busy}>
                {busy === 'meeting' ? <Spinner /> : 'Process meeting → board'}
              </Button>
            </div>
          </>
        )}

        {tab === 'analyze' && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={summarize} disabled={!!busy}>
                {busy === 'summary' ? <Spinner /> : 'Summarize'}
              </Button>
              <Button variant="ghost" onClick={extractTasks} disabled={!!busy}>
                {busy === 'tasks' ? <Spinner /> : 'Extract tasks'}
              </Button>
              <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                {busy === 'vision' ? <Spinner /> : '🖼 Analyze image'}
                <input type="file" accept="image/*" className="hidden" onChange={onVisionFile} disabled={!!busy} />
              </label>
            </div>
            <p className="text-xs text-slate-400">
              Image analysis needs a vision-capable local model (e.g. llava, qwen2-vl).
            </p>
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
          <div className="space-y-2">
            {chatLog.length === 0 && <p className="text-slate-400">Ask anything about this board.</p>}
            {chatLog.map((m, i) => (
              <div
                key={i}
                className={`rounded p-2 text-xs ${
                  m.role === 'user' ? 'bg-indigo-50 dark:bg-indigo-950' : 'bg-slate-50 dark:bg-slate-800'
                }`}
              >
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))}
            {busy === 'chat' && <Spinner className="text-indigo-600" />}
          </div>
        )}
      </div>

      {tab === 'agent' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendCommand();
          }}
          className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-800"
        >
          <Input
            placeholder="Tell the assistant what to change…"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <Button type="submit" disabled={!!busy}>
            {busy === 'command' ? <Spinner /> : 'Run'}
          </Button>
        </form>
      )}

      {tab === 'chat' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendChat();
          }}
          className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-800"
        >
          <Input placeholder="Ask the board…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
          <Button type="submit" disabled={!!busy}>
            Send
          </Button>
        </form>
      )}
    </aside>
  );
}
