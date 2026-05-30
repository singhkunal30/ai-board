import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { getAccessToken } from '../api';
import { getWsUrl } from '../config';
import { colorFor } from '../util';
import type { BoardEdge, BoardObjectBase, Point } from '../types';

const LOCAL_ORIGIN = 'local';

export interface BoardSync {
  connected: boolean;
  objects: BoardObjectBase[];
  edges: BoardEdge[];
  collaborators: number;
  addObject: (obj: BoardObjectBase) => void;
  addFragment: (objects: BoardObjectBase[], edges: BoardEdge[]) => void;
  addEdge: (edge: BoardEdge) => void;
  patchObject: (
    id: string,
    patch: { data?: Record<string, unknown>; style?: Record<string, unknown>; position?: Point },
  ) => void;
  removeObjects: (ids: string[]) => void;
}

/**
 * Connects to the Hocuspocus (Yjs) realtime server for a board and exposes the
 * shared document as reactive state. Mirrors the web client's sync model: Yjs
 * is the source of truth, local writes are tagged so the observer ignores its
 * own echoes.
 */
export function useBoardSync(boardId: string, userId: string): BoardSync {
  const [connected, setConnected] = useState(false);
  const [objects, setObjects] = useState<BoardObjectBase[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [collaborators, setCollaborators] = useState(0);

  const docRef = useRef<Y.Doc | null>(null);
  const maps = useRef<{ objects: Y.Map<BoardObjectBase>; edges: Y.Map<BoardEdge> } | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const doc = new Y.Doc();
    docRef.current = doc;
    const yObjects = doc.getMap<BoardObjectBase>('objects');
    const yEdges = doc.getMap<BoardEdge>('edges');
    maps.current = { objects: yObjects, edges: yEdges };

    const rebuild = () => {
      setObjects(Array.from(yObjects.values()));
      setEdges(Array.from(yEdges.values()));
    };
    yObjects.observeDeep(rebuild);
    yEdges.observeDeep(rebuild);

    const provider = new HocuspocusProvider({
      url: getWsUrl(),
      name: boardId,
      token,
      document: doc,
      onStatus: ({ status }) => setConnected(status === 'connected'),
      onSynced: rebuild,
    });

    const awareness = provider.awareness;
    awareness?.setLocalStateField('user', { userId, color: colorFor(userId) });
    const onAwareness = () => setCollaborators(Math.max((awareness?.getStates().size ?? 1) - 1, 0));
    awareness?.on('change', onAwareness);

    return () => {
      awareness?.off('change', onAwareness);
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      maps.current = null;
    };
  }, [boardId, userId]);

  const tx = useCallback((fn: () => void) => docRef.current?.transact(fn, LOCAL_ORIGIN), []);

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
  const patchObject = useCallback(
    (id: string, patch: { data?: Record<string, unknown>; style?: Record<string, unknown>; position?: Point }) =>
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
        maps.current?.edges.forEach((e, key) => {
          if (ids.includes(e.source) || ids.includes(e.target)) maps.current?.edges.delete(key);
        });
      }),
    [tx],
  );

  return useMemo(
    () => ({
      connected,
      objects,
      edges,
      collaborators,
      addObject,
      addFragment,
      addEdge,
      patchObject,
      removeObjects,
    }),
    [connected, objects, edges, collaborators, addObject, addFragment, addEdge, patchObject, removeObjects],
  );
}
