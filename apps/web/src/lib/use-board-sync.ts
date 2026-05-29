'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import type { BoardEdge, BoardObjectBase, BoardObjectType, PresenceState } from '@ai-board/shared';
import { WS_URL } from './config';
import { useAuthStore } from './auth-store';

const LOCAL_ORIGIN = 'local';

export interface BoardSync {
  connected: boolean;
  objects: BoardObjectBase[];
  edges: BoardEdge[];
  presence: PresenceState[];
  addObject: (obj: BoardObjectBase) => void;
  /** Append many objects/edges at once (used by AI generation results). */
  addFragment: (objects: BoardObjectBase[], edges: BoardEdge[]) => void;
  addEdge: (edge: BoardEdge) => void;
  updateObjectPosition: (id: string, position: { x: number; y: number }) => void;
  updateObjectData: (id: string, data: Record<string, unknown>) => void;
  /** Merge any of data/style/position into an object in one transaction. */
  patchObject: (
    id: string,
    patch: { data?: Record<string, unknown>; style?: Record<string, unknown>; position?: { x: number; y: number } },
  ) => void;
  removeObjects: (ids: string[]) => void;
  setCursor: (point: { x: number; y: number } | null) => void;
}

function colorFor(id: string): string {
  const palette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % palette.length;
  return palette[h];
}

/**
 * Connects to the Hocuspocus (Yjs) realtime server for a board and exposes the
 * shared document as reactive React state. Yjs is the source of truth; local
 * mutations are written inside a transaction tagged `LOCAL_ORIGIN` so the
 * observer can ignore its own echoes and avoid feedback loops.
 */
export function useBoardSync(boardId: string): BoardSync {
  const { accessToken, user } = useAuthStore();
  const [connected, setConnected] = useState(false);
  const [objects, setObjects] = useState<BoardObjectBase[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [presence, setPresence] = useState<PresenceState[]>([]);

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);

  const maps = useRef<{ objects: Y.Map<BoardObjectBase>; edges: Y.Map<BoardEdge> } | null>(null);

  useEffect(() => {
    if (!accessToken || !user) return;
    const doc = new Y.Doc();
    docRef.current = doc;
    const yObjects = doc.getMap<BoardObjectBase>('objects');
    const yEdges = doc.getMap<BoardEdge>('edges');
    maps.current = { objects: yObjects, edges: yEdges };

    const rebuild = () => {
      setObjects(Array.from(yObjects.values()));
      setEdges(Array.from(yEdges.values()));
    };

    yObjects.observeDeep(() => rebuild());
    yEdges.observeDeep(() => rebuild());

    const provider = new HocuspocusProvider({
      url: WS_URL,
      name: boardId,
      token: accessToken,
      document: doc,
      onStatus: ({ status }) => setConnected(status === 'connected'),
      onSynced: () => rebuild(),
    });
    providerRef.current = provider;

    // Presence via Yjs awareness.
    const awareness = provider.awareness!;
    awareness.setLocalStateField('user', {
      userId: user.id,
      name: user.name,
      color: colorFor(user.id),
      cursor: null,
      lastActiveAt: Date.now(),
    } satisfies PresenceState);

    const onAwareness = () => {
      const states: PresenceState[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const u = (state as { user?: PresenceState }).user;
        if (u) states.push(u);
      });
      setPresence(states);
    };
    awareness.on('change', onAwareness);

    return () => {
      awareness.off('change', onAwareness);
      provider.destroy();
      doc.destroy();
      providerRef.current = null;
      docRef.current = null;
      maps.current = null;
    };
  }, [boardId, accessToken, user]);

  const tx = useCallback((fn: () => void) => {
    docRef.current?.transact(fn, LOCAL_ORIGIN);
  }, []);

  const addObject = useCallback(
    (obj: BoardObjectBase) => tx(() => maps.current?.objects.set(obj.id, obj)),
    [tx],
  );

  const addFragment = useCallback(
    (objs: BoardObjectBase[], es: BoardEdge[]) =>
      tx(() => {
        objs.forEach((o) => maps.current?.objects.set(o.id, o));
        es.forEach((e) => maps.current?.edges.set(e.id, e));
      }),
    [tx],
  );

  const addEdge = useCallback(
    (edge: BoardEdge) => tx(() => maps.current?.edges.set(edge.id, edge)),
    [tx],
  );

  const updateObjectPosition = useCallback(
    (id: string, position: { x: number; y: number }) =>
      tx(() => {
        const obj = maps.current?.objects.get(id);
        if (obj) maps.current?.objects.set(id, { ...obj, position });
      }),
    [tx],
  );

  const updateObjectData = useCallback(
    (id: string, data: Record<string, unknown>) =>
      tx(() => {
        const obj = maps.current?.objects.get(id);
        if (obj) maps.current?.objects.set(id, { ...obj, data: { ...obj.data, ...data } });
      }),
    [tx],
  );

  const patchObject = useCallback(
    (
      id: string,
      patch: { data?: Record<string, unknown>; style?: Record<string, unknown>; position?: { x: number; y: number } },
    ) =>
      tx(() => {
        const obj = maps.current?.objects.get(id);
        if (!obj) return;
        maps.current?.objects.set(id, {
          ...obj,
          ...(patch.position ? { position: patch.position } : {}),
          ...(patch.data ? { data: { ...obj.data, ...patch.data } } : {}),
          ...(patch.style ? { style: { ...obj.style, ...patch.style } } : {}),
        });
      }),
    [tx],
  );

  const removeObjects = useCallback(
    (ids: string[]) =>
      tx(() => {
        ids.forEach((id) => maps.current?.objects.delete(id));
        // Drop dangling edges.
        maps.current?.edges.forEach((e, key) => {
          if (ids.includes(e.source) || ids.includes(e.target)) maps.current?.edges.delete(key);
        });
      }),
    [tx],
  );

  const setCursor = useCallback(
    (point: { x: number; y: number } | null) => {
      const awareness = providerRef.current?.awareness;
      if (!awareness) return;
      const current = awareness.getLocalState()?.user as PresenceState | undefined;
      if (current) {
        awareness.setLocalStateField('user', { ...current, cursor: point, lastActiveAt: Date.now() });
      }
    },
    [],
  );

  return useMemo(
    () => ({
      connected,
      objects,
      edges,
      presence,
      addObject,
      addFragment,
      addEdge,
      updateObjectPosition,
      updateObjectData,
      patchObject,
      removeObjects,
      setCursor,
    }),
    [
      connected,
      objects,
      edges,
      presence,
      addObject,
      addFragment,
      addEdge,
      updateObjectPosition,
      updateObjectData,
      patchObject,
      removeObjects,
      setCursor,
    ],
  );
}

export type { BoardObjectType };
