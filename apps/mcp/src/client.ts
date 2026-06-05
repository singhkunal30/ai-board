/** Minimal client for the AI-Board REST API, authenticated with an API key. */

export interface BoardObject {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  data: Record<string, unknown>;
  style?: Record<string, unknown>;
}
export interface BoardSnapshot {
  schemaVersion: number;
  objects: BoardObject[];
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
}

const BASE = (process.env.AI_BOARD_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const API_KEY = process.env.AI_BOARD_API_KEY ?? '';

export class AiBoardClient {
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (!API_KEY) throw new Error('AI_BOARD_API_KEY is not set');
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const msg = (data?.message as string) ?? `Request failed (${res.status})`;
      throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    return data as T;
  }

  listWorkspaces() {
    return this.request<Array<{ id: string; name: string; role: string }>>('/workspaces');
  }
  listBoards(workspaceId: string) {
    return this.request<Array<{ id: string; title: string; updatedAt: string }>>(
      `/workspaces/${workspaceId}/boards`,
    );
  }
  createBoard(workspaceId: string, title: string, templateId?: string) {
    return this.request<{ id: string; title: string }>(`/workspaces/${workspaceId}/boards`, 'POST', {
      title,
      ...(templateId ? { templateId } : {}),
    });
  }
  getBoard(boardId: string) {
    return this.request<{ id: string; title: string; snapshot: BoardSnapshot }>(`/boards/${boardId}`);
  }
  saveSnapshot(boardId: string, snapshot: BoardSnapshot) {
    return this.request(`/boards/${boardId}/snapshot`, 'PUT', snapshot);
  }
  command(boardId: string, instruction: string) {
    return this.request<{ reply: string; operations: unknown[] }>(
      `/boards/${boardId}/ai/command`,
      'POST',
      { instruction },
    );
  }
  generate(boardId: string, kind: 'mindmap' | 'diagram', prompt: string) {
    return this.request<{ objects: unknown[]; edges: unknown[] }>(
      `/boards/${boardId}/ai/${kind}`,
      'POST',
      { prompt },
    );
  }
  summarize(boardId: string) {
    return this.request<{ summary: string }>(`/boards/${boardId}/ai/summary`);
  }
  ask(boardId: string, message: string) {
    return this.request<{ answer: string; sources: Array<{ content: string }> }>(
      `/boards/${boardId}/ai/chat`,
      'POST',
      { message },
    );
  }
  vision(boardId: string, imageBase64: string, prompt?: string) {
    return this.request<{ analysis: string }>(`/boards/${boardId}/ai/vision`, 'POST', {
      imageBase64,
      ...(prompt ? { prompt } : {}),
    });
  }
}

export function objectText(o: BoardObject): string {
  const d = o.data ?? {};
  for (const k of ['text', 'label', 'content', 'title']) {
    const v = d[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
