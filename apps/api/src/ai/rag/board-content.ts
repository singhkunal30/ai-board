import { BoardObjectBase, BoardSnapshot } from '@ai-board/shared';

/**
 * Extracts human-readable text from a board object's free-form `data`. Object
 * types store their text under different keys (text/label/content/title), so we
 * probe the common ones.
 */
export function objectText(obj: BoardObjectBase): string {
  const d = obj.data ?? {};
  const candidates = [d.text, d.label, d.content, d.title, d.body, d.name];
  const parts = candidates.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return parts.join(' — ').trim();
}

/** A flat, labeled rendering of a board for prompting the model. */
export function renderBoardForPrompt(snapshot: BoardSnapshot): string {
  const lines: string[] = [];
  for (const obj of snapshot.objects) {
    const text = objectText(obj);
    if (text) lines.push(`- [${obj.type}] ${text}`);
  }
  if (snapshot.edges.length > 0) {
    lines.push('\nConnections:');
    const byId = new Map(snapshot.objects.map((o) => [o.id, objectText(o) || o.id]));
    for (const e of snapshot.edges) {
      const from = byId.get(e.source) ?? e.source;
      const to = byId.get(e.target) ?? e.target;
      lines.push(`- ${from} → ${to}${e.label ? ` (${e.label})` : ''}`);
    }
  }
  return lines.join('\n');
}

/** Per-object text units used to build embeddings for retrieval. */
export function boardTextUnits(
  snapshot: BoardSnapshot,
): Array<{ objectId: string; content: string }> {
  return snapshot.objects
    .map((o) => ({ objectId: o.id, content: objectText(o) }))
    .filter((u) => u.content.length > 0);
}
