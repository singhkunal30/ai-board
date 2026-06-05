'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  ViewportPortal,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  BoardObjectType,
  type AppliedBoardOp,
  type BoardObjectBase,
} from '@ai-board/shared';
import { api } from '@/lib/api';
import { useBoardSync } from '@/lib/use-board-sync';
import { BoardNode, type BoardNodeData } from './nodes/BoardNode';
import { AiPanel } from './AiPanel';
import { Inspector } from './Inspector';
import { LayersPanel } from './LayersPanel';
import { AlignToolbar } from './AlignToolbar';
import { ExportMenu } from './ExportMenu';
import { Button } from './ui';

const nodeTypes = { board: BoardNode };

type Tool = 'sticky' | 'text' | 'rectangle' | 'ellipse' | 'frame';

function newObject(tool: Tool, x: number, y: number): BoardObjectBase {
  const base = {
    id: crypto.randomUUID(),
    position: { x: Math.round(x), y: Math.round(y) },
    zIndex: 0,
  };
  switch (tool) {
    case 'sticky':
      return { ...base, type: BoardObjectType.STICKY_NOTE, size: { width: 180, height: 180 }, data: { text: '' }, style: { fill: '#fef08a' } };
    case 'text':
      return { ...base, type: BoardObjectType.TEXT, size: { width: 220, height: 40 }, data: { text: '' }, style: { fontSize: 18, color: '#0f172a' } };
    case 'rectangle':
      return { ...base, type: BoardObjectType.SHAPE, size: { width: 200, height: 120 }, data: { text: '' }, style: { shape: 'rectangle', fill: '#93c5fd', stroke: '#1d4ed8', strokeWidth: 1, radius: 8 } };
    case 'ellipse':
      return { ...base, type: BoardObjectType.SHAPE, size: { width: 160, height: 160 }, data: { text: '' }, style: { shape: 'ellipse', fill: '#a7f3d0', stroke: '#047857', strokeWidth: 1 } };
    case 'frame':
      return { ...base, type: BoardObjectType.FRAME, size: { width: 400, height: 300 }, zIndex: -1, data: { text: 'Frame' }, style: { fill: 'rgba(148,163,184,0.06)' } };
  }
}

/** Renders collaborators' live cursors in flow coordinates. */
function RemoteCursors({ sync }: { sync: ReturnType<typeof useBoardSync> }) {
  return (
    <ViewportPortal>
      {sync.presence
        .filter((p) => p.cursor)
        .map((p) => (
          <div
            key={p.userId}
            className="pointer-events-none absolute z-50"
            style={{ transform: `translate(${p.cursor!.x}px, ${p.cursor!.y}px)` }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={p.color}>
              <path d="M3 3l7.5 18 2.5-7 7-2.5L3 3z" />
            </svg>
            <span className="ml-3 rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ background: p.color }}>
              {p.name}
            </span>
          </div>
        ))}
    </ViewportPortal>
  );
}

function CanvasInner({ boardId, title }: { boardId: string; title: string }) {
  const sync = useBoardSync(boardId);
  const { screenToFlowPosition } = useReactFlow();
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTextChange = useCallback((id: string, text: string) => sync.updateObjectData(id, { text }), [sync]);
  const onResize = useCallback(
    (id: string, size: { width: number; height: number }, position: { x: number; y: number }) =>
      sync.patchObject(id, { size, position }),
    [sync],
  );

  // Rebuild React Flow nodes when the shared objects change. Hidden objects are
  // omitted; locked objects are not draggable.
  useEffect(() => {
    setRfNodes(
      sync.objects
        .filter((o) => !o.data?.__hidden)
        .map((object) => {
          const locked = Boolean(object.data?.__locked);
          return {
            id: object.id,
            type: 'board',
            position: object.position,
            width: object.size.width,
            height: object.size.height,
            zIndex: object.zIndex,
            draggable: !locked,
            data: { object, onTextChange, onResize, editable: true, locked } satisfies BoardNodeData,
            style: { width: object.size.width, height: object.size.height },
          };
        }),
    );
  }, [sync.objects, onTextChange, onResize]);

  const rfEdges: Edge[] = useMemo(
    () => sync.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
    [sync.edges],
  );

  // Debounced persistence to the REST snapshot so server-side AI reads live content.
  useEffect(() => {
    if (!sync.connected) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void api(`/boards/${boardId}/snapshot`, {
        method: 'PUT',
        body: { schemaVersion: 1, objects: sync.objects, edges: sync.edges },
      }).catch(() => undefined);
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [sync.objects, sync.edges, sync.connected, boardId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((ns) => applyNodeChanges(changes, ns));
      const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id);
      if (removed.length) sync.removeObjects(removed);
    },
    [sync],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) sync.addEdge({ id: crypto.randomUUID(), source: c.source, target: c.target });
    },
    [sync],
  );

  // Cmd/Ctrl+D duplicates the selected nodes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        for (const n of rfNodes.filter((node) => node.selected)) {
          const obj = (n.data as BoardNodeData).object;
          sync.addObject({ ...obj, id: crypto.randomUUID(), position: { x: obj.position.x + 24, y: obj.position.y + 24 } });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rfNodes, sync]);

  const addAt = useCallback(
    (tool: Tool) => {
      const c = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      sync.addObject(newObject(tool, c.x - 90, c.y - 45));
    },
    [screenToFlowPosition, sync],
  );

  const applyOps = useCallback(
    (ops: AppliedBoardOp[]) => {
      for (const op of ops) {
        if (op.kind === 'add') sync.addObject(op.object);
        else if (op.kind === 'update') sync.patchObject(op.id, { data: op.data, style: op.style, position: op.position });
        else if (op.kind === 'delete') sync.removeObjects(op.ids);
        else if (op.kind === 'connect') sync.addEdge(op.edge);
      }
    },
    [sync],
  );

  const selectedObject = selectedIds.length === 1 ? sync.objects.find((o) => o.id === selectedIds[0]) : undefined;

  return (
    <div className="relative h-full w-full">
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-lg border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <Button variant="ghost" onClick={() => addAt('sticky')}>Sticky</Button>
        <Button variant="ghost" onClick={() => addAt('text')}>Text</Button>
        <Button variant="ghost" onClick={() => addAt('rectangle')}>▭</Button>
        <Button variant="ghost" onClick={() => addAt('ellipse')}>◯</Button>
        <Button variant="ghost" onClick={() => addAt('frame')}>Frame</Button>
        <span className="mx-1 w-px self-stretch bg-slate-200 dark:bg-slate-700" />
        <ExportMenu title={title} objects={sync.objects} edges={sync.edges} />
      </div>

      {/* Presence + connection status */}
      <div className="absolute right-[17rem] top-3 z-10 flex items-center gap-2">
        {sync.presence.map((p) => (
          <span key={p.userId} title={p.name} className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: p.color }}>
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        <span className={`h-2.5 w-2.5 rounded-full ${sync.connected ? 'bg-green-500' : 'bg-amber-500'}`} title={sync.connected ? 'Connected' : 'Connecting…'} />
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, node) => sync.updateObjectPosition(node.id, node.position)}
        onConnect={onConnect}
        onSelectionChange={({ nodes }) => setSelectedIds(nodes.map((n) => n.id))}
        onPaneMouseMove={(e) => sync.setCursor(screenToFlowPosition({ x: e.clientX, y: e.clientY }))}
        snapToGrid
        snapGrid={[8, 8]}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
        <RemoteCursors sync={sync} />
      </ReactFlow>

      <LayersPanel objects={sync.objects} selectedIds={selectedIds} onPatch={sync.patchObject} onRemove={(id) => sync.removeObjects([id])} />

      {selectedIds.length >= 2 && <AlignToolbar objects={sync.objects.filter((o) => selectedIds.includes(o.id))} onPatch={sync.patchObject} />}

      {selectedObject && <Inspector object={selectedObject} onChange={sync.patchObject} />}

      <AiPanel boardId={boardId} onFragment={(o, e) => sync.addFragment(o, e)} onOps={applyOps} />
    </div>
  );
}

export function BoardCanvas({ boardId, title }: { boardId: string; title: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner boardId={boardId} title={title} />
    </ReactFlowProvider>
  );
}
