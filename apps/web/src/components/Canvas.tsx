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
import { BoardObjectType, type BoardObjectBase } from '@ai-board/shared';
import { api } from '@/lib/api';
import { useBoardSync } from '@/lib/use-board-sync';
import { BoardNode, type BoardNodeData } from './nodes/BoardNode';
import { AiPanel } from './AiPanel';
import { Button } from './ui';

const nodeTypes = { board: BoardNode };

function newObject(type: BoardObjectType, x: number, y: number): BoardObjectBase {
  const isSticky = type === BoardObjectType.STICKY_NOTE;
  return {
    id: crypto.randomUUID(),
    type,
    position: { x: Math.round(x), y: Math.round(y) },
    size: isSticky ? { width: 180, height: 180 } : { width: 200, height: 90 },
    zIndex: 0,
    data: { text: '' },
    style: isSticky ? { background: '#fef08a' } : undefined,
  };
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
            <span
              className="ml-3 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ background: p.color }}
            >
              {p.name}
            </span>
          </div>
        ))}
    </ViewportPortal>
  );
}

function CanvasInner({ boardId }: { boardId: string }) {
  const sync = useBoardSync(boardId);
  const { screenToFlowPosition } = useReactFlow();
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTextChange = useCallback(
    (id: string, text: string) => sync.updateObjectData(id, { text }),
    [sync],
  );

  // Rebuild React Flow nodes whenever the shared objects change (remote or local-committed).
  useEffect(() => {
    setRfNodes(
      sync.objects.map((object) => ({
        id: object.id,
        type: 'board',
        position: object.position,
        width: object.size.width,
        height: object.size.height,
        data: { object, onTextChange, editable: true } satisfies BoardNodeData,
        style: { width: object.size.width, height: object.size.height },
      })),
    );
  }, [sync.objects, onTextChange]);

  const rfEdges: Edge[] = useMemo(
    () =>
      sync.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: false,
      })),
    [sync.edges],
  );

  // Debounced persistence of the live document to the REST snapshot, so the
  // server-side AI features (summary, tasks, RAG chat) read current content.
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
      if (c.source && c.target) {
        sync.addEdge({ id: crypto.randomUUID(), source: c.source, target: c.target });
      }
    },
    [sync],
  );

  const addAt = useCallback(
    (type: BoardObjectType) => {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      sync.addObject(newObject(type, center.x - 90, center.y - 45));
    },
    [screenToFlowPosition, sync],
  );

  return (
    <div className="relative h-full w-full">
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-10 flex gap-2 rounded-lg border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <Button variant="ghost" onClick={() => addAt(BoardObjectType.STICKY_NOTE)}>
          + Sticky
        </Button>
        <Button variant="ghost" onClick={() => addAt(BoardObjectType.TEXT)}>
          + Text
        </Button>
        <Button variant="ghost" onClick={() => addAt(BoardObjectType.SHAPE)}>
          + Shape
        </Button>
      </div>

      {/* Presence + connection status */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {sync.presence.map((p) => (
          <span
            key={p.userId}
            title={p.name}
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: p.color }}
          >
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        <span
          className={`h-2.5 w-2.5 rounded-full ${sync.connected ? 'bg-green-500' : 'bg-amber-500'}`}
          title={sync.connected ? 'Connected' : 'Connecting…'}
        />
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, node) => sync.updateObjectPosition(node.id, node.position)}
        onConnect={onConnect}
        onPaneMouseMove={(e) =>
          sync.setCursor(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
        }
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
        <RemoteCursors sync={sync} />
      </ReactFlow>

      <AiPanel boardId={boardId} onFragment={(o, e) => sync.addFragment(o, e)} />
    </div>
  );
}

export function BoardCanvas({ boardId }: { boardId: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner boardId={boardId} />
    </ReactFlowProvider>
  );
}
