import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  AppliedBoardOp,
  BoardObjectBase,
  BoardObjectType,
  BoardSnapshot,
  Point,
} from '@ai-board/shared';

/** Defensive schema for the raw operations emitted by the model. */
const rawOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_note'), text: z.string().max(2000), color: z.string().max(32).optional() }),
  z.object({ op: z.literal('add_text'), text: z.string().max(2000) }),
  z.object({
    op: z.literal('update'),
    id: z.string(),
    text: z.string().max(2000).optional(),
    color: z.string().max(32).optional(),
  }),
  z.object({ op: z.literal('move'), id: z.string(), x: z.number(), y: z.number() }),
  z.object({ op: z.literal('delete'), id: z.string() }),
  z.object({
    op: z.literal('connect'),
    source: z.string(),
    target: z.string(),
    label: z.string().max(120).optional(),
  }),
]);

export const commandResponseSchema = z.object({
  reply: z.string().max(2000).optional(),
  operations: z.array(rawOpSchema).max(100).default([]),
});
export type RawCommandResponse = z.infer<typeof commandResponseSchema>;

const STICKY = { width: 180, height: 180 };
const TEXT = { width: 240, height: 56 };

/**
 * Applies validated model operations to a board snapshot. Returns the mutated
 * snapshot and the list of concrete, resolved operations the client should
 * replay onto the live Yjs document. Operations referencing unknown ids are
 * skipped (the model can only act on ids it was shown).
 */
export function applyCommand(
  snapshot: BoardSnapshot,
  parsed: RawCommandResponse,
  origin: Point,
): { snapshot: BoardSnapshot; operations: AppliedBoardOp[] } {
  const objects = [...snapshot.objects];
  const edges = [...snapshot.edges];
  const byId = new Map(objects.map((o) => [o.id, o]));
  const operations: AppliedBoardOp[] = [];

  // Auto-placement cursor for newly added objects (a tidy grid near free space).
  let placed = 0;
  const nextPos = (): Point => {
    const col = placed % 4;
    const row = Math.floor(placed / 4);
    placed++;
    return { x: origin.x + col * 210, y: origin.y + row * 210 };
  };

  for (const op of parsed.operations) {
    switch (op.op) {
      case 'add_note': {
        const obj: BoardObjectBase = {
          id: randomUUID(),
          type: BoardObjectType.STICKY_NOTE,
          position: nextPos(),
          size: STICKY,
          zIndex: 0,
          data: { text: op.text },
          style: { background: op.color ?? '#fef08a' },
        };
        objects.push(obj);
        byId.set(obj.id, obj);
        operations.push({ kind: 'add', object: obj });
        break;
      }
      case 'add_text': {
        const obj: BoardObjectBase = {
          id: randomUUID(),
          type: BoardObjectType.TEXT,
          position: nextPos(),
          size: TEXT,
          zIndex: 1,
          data: { text: op.text },
          style: { fontWeight: 700, fontSize: 18 },
        };
        objects.push(obj);
        byId.set(obj.id, obj);
        operations.push({ kind: 'add', object: obj });
        break;
      }
      case 'update': {
        const target = byId.get(op.id);
        if (!target) break;
        const data = op.text !== undefined ? { ...target.data, text: op.text } : target.data;
        const style = op.color !== undefined ? { ...target.style, background: op.color } : target.style;
        const updated = { ...target, data, style };
        replace(objects, updated);
        byId.set(updated.id, updated);
        operations.push({
          kind: 'update',
          id: op.id,
          ...(op.text !== undefined ? { data: { text: op.text } } : {}),
          ...(op.color !== undefined ? { style: { background: op.color } } : {}),
        });
        break;
      }
      case 'move': {
        const target = byId.get(op.id);
        if (!target) break;
        const position = { x: Math.round(op.x), y: Math.round(op.y) };
        const updated = { ...target, position };
        replace(objects, updated);
        byId.set(updated.id, updated);
        operations.push({ kind: 'update', id: op.id, position });
        break;
      }
      case 'delete': {
        if (!byId.has(op.id)) break;
        removeById(objects, op.id);
        byId.delete(op.id);
        // Drop edges touching the deleted node.
        for (let i = edges.length - 1; i >= 0; i--) {
          if (edges[i].source === op.id || edges[i].target === op.id) edges.splice(i, 1);
        }
        operations.push({ kind: 'delete', ids: [op.id] });
        break;
      }
      case 'connect': {
        if (!byId.has(op.source) || !byId.has(op.target)) break;
        const edge = { id: randomUUID(), source: op.source, target: op.target, label: op.label };
        edges.push(edge);
        operations.push({ kind: 'connect', edge });
        break;
      }
    }
  }

  return {
    snapshot: { schemaVersion: snapshot.schemaVersion || 1, objects, edges },
    operations,
  };
}

function replace(objects: BoardObjectBase[], updated: BoardObjectBase): void {
  const i = objects.findIndex((o) => o.id === updated.id);
  if (i >= 0) objects[i] = updated;
}

function removeById(objects: BoardObjectBase[], id: string): void {
  const i = objects.findIndex((o) => o.id === id);
  if (i >= 0) objects.splice(i, 1);
}
