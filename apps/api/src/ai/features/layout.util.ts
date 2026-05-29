import { randomUUID } from 'node:crypto';
import {
  BoardEdge,
  BoardObjectBase,
  BoardObjectType,
} from '@ai-board/shared';

export interface GeneratedFragment {
  objects: BoardObjectBase[];
  edges: BoardEdge[];
}

const NODE_W = 200;
const NODE_H = 90;

function node(
  type: BoardObjectType,
  x: number,
  y: number,
  data: Record<string, unknown>,
  zIndex: number,
  style?: Record<string, unknown>,
): BoardObjectBase {
  return {
    id: randomUUID(),
    type,
    position: { x: Math.round(x), y: Math.round(y) },
    size: { width: NODE_W, height: NODE_H },
    zIndex,
    data,
    style,
  };
}

export interface MindMap {
  root: string;
  branches: Array<{ title: string; children?: string[] }>;
}

/**
 * Lays a mind map out radially: the root at `origin`, branches evenly around a
 * circle, each branch's children stacked outward along its ray.
 */
export function layoutMindMap(map: MindMap, origin = { x: 0, y: 0 }): GeneratedFragment {
  const objects: BoardObjectBase[] = [];
  const edges: BoardEdge[] = [];

  const root = node(
    BoardObjectType.MINDMAP_NODE,
    origin.x,
    origin.y,
    { text: map.root, level: 0 },
    2,
    { background: '#4f46e5', color: '#ffffff' },
  );
  objects.push(root);

  const branchRadius = 360;
  const count = Math.max(map.branches.length, 1);
  map.branches.forEach((branch, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const bx = origin.x + Math.cos(angle) * branchRadius;
    const by = origin.y + Math.sin(angle) * branchRadius;
    const branchNode = node(
      BoardObjectType.MINDMAP_NODE,
      bx,
      by,
      { text: branch.title, level: 1 },
      1,
      { background: '#e0e7ff' },
    );
    objects.push(branchNode);
    edges.push({ id: randomUUID(), source: root.id, target: branchNode.id });

    (branch.children ?? []).forEach((child, j) => {
      const cx = origin.x + Math.cos(angle) * (branchRadius + (j + 1) * 220);
      const cy = origin.y + Math.sin(angle) * (branchRadius + (j + 1) * 220) + j * 30;
      const childNode = node(
        BoardObjectType.MINDMAP_NODE,
        cx,
        cy,
        { text: child, level: 2 },
        0,
      );
      objects.push(childNode);
      edges.push({ id: randomUUID(), source: branchNode.id, target: childNode.id });
    });
  });

  return { objects, edges };
}

export interface DiagramSpec {
  nodes: Array<{ id: string; label: string; group?: string }>;
  edges: Array<{ source: string; target: string; label?: string }>;
}

/**
 * Lays a diagram out in layers using a longest-path layering of the DAG, so
 * sources sit left and dependents flow right. Cycles are tolerated (nodes not
 * yet placed fall to the last layer).
 */
export function layoutDiagram(spec: DiagramSpec, origin = { x: 0, y: 0 }): GeneratedFragment {
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const n of spec.nodes) {
    adjacency.set(n.id, []);
    indegree.set(n.id, 0);
  }
  for (const e of spec.edges) {
    if (!adjacency.has(e.source) || !indegree.has(e.target)) continue;
    adjacency.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }

  // Kahn-style layering.
  const layer = new Map<string, number>();
  let frontier = spec.nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (frontier.length === 0 && spec.nodes.length > 0) frontier = [spec.nodes[0].id];
  const seen = new Set<string>();
  let depth = 0;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      layer.set(id, depth);
      for (const t of adjacency.get(id) ?? []) if (!seen.has(t)) next.push(t);
    }
    frontier = next;
    depth++;
  }
  for (const n of spec.nodes) if (!layer.has(n.id)) layer.set(n.id, depth);

  const colGap = 320;
  const rowGap = 130;
  const perColumn = new Map<number, number>();
  const idToObject = new Map<string, BoardObjectBase>();
  const objects: BoardObjectBase[] = [];

  for (const n of spec.nodes) {
    const col = layer.get(n.id) ?? 0;
    const row = perColumn.get(col) ?? 0;
    perColumn.set(col, row + 1);
    const obj = node(
      BoardObjectType.FLOWCHART_NODE,
      origin.x + col * colGap,
      origin.y + row * rowGap,
      { text: n.label, group: n.group },
      1,
      n.group ? { background: '#ecfeff' } : undefined,
    );
    idToObject.set(n.id, obj);
    objects.push(obj);
  }

  const edges: BoardEdge[] = [];
  for (const e of spec.edges) {
    const s = idToObject.get(e.source);
    const t = idToObject.get(e.target);
    if (s && t) edges.push({ id: randomUUID(), source: s.id, target: t.id, label: e.label });
  }

  return { objects, edges };
}

/** A standalone text/heading object. */
export function textNode(
  text: string,
  x: number,
  y: number,
  style?: Record<string, unknown>,
): BoardObjectBase {
  return {
    id: randomUUID(),
    type: BoardObjectType.TEXT,
    position: { x: Math.round(x), y: Math.round(y) },
    size: { width: 240, height: 48 },
    zIndex: 1,
    data: { text },
    style: { fontWeight: 700, fontSize: 18, ...style },
  };
}

/** A titled vertical column of sticky notes (heading + stacked notes). */
export function labeledColumn(
  title: string,
  items: string[],
  origin: { x: number; y: number },
  color: string,
): GeneratedFragment {
  const heading = textNode(title, origin.x, origin.y);
  const grid = layoutStickyGrid(items, { x: origin.x, y: origin.y + 64 }, 1, color);
  return { objects: [heading, ...grid.objects], edges: [] };
}

/** Places a list of short texts as a tidy grid of sticky notes. */
export function layoutStickyGrid(
  texts: string[],
  origin = { x: 0, y: 0 },
  columns = 4,
  color = '#fef08a',
): GeneratedFragment {
  const gap = 30;
  const w = 180;
  const h = 180;
  const objects = texts.map((text, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    return node(
      BoardObjectType.STICKY_NOTE,
      origin.x + col * (w + gap),
      origin.y + row * (h + gap),
      { text },
      0,
      { background: color },
    );
  });
  // sticky notes are fixed-size squares
  for (const o of objects) o.size = { width: w, height: h };
  return { objects, edges: [] };
}
