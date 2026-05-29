/**
 * Board domain types.
 *
 * The canvas is an infinite 2-D plane. Each object ("node") has a position,
 * size, z-index and a discriminated `type` carrying type-specific `data`.
 * Live editing is driven by Yjs (CRDT); these types describe the serialized
 * snapshot persisted to Postgres and exchanged over the REST API.
 */

export const BoardObjectType = {
  STICKY_NOTE: 'sticky_note',
  TEXT: 'text',
  SHAPE: 'shape',
  ARROW: 'arrow',
  CONNECTOR: 'connector',
  IMAGE: 'image',
  CODE: 'code',
  MARKDOWN: 'markdown',
  TABLE: 'table',
  FRAME: 'frame',
  FLOWCHART_NODE: 'flowchart_node',
  UML_ELEMENT: 'uml_element',
  MINDMAP_NODE: 'mindmap_node',
} as const;
export type BoardObjectType = (typeof BoardObjectType)[keyof typeof BoardObjectType];

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BoardObjectBase {
  id: string;
  type: BoardObjectType;
  position: Point;
  size: Size;
  rotation?: number;
  zIndex: number;
  /** Optional parent frame/group id. */
  parentId?: string | null;
  /** Free-form, type-specific payload (text, style, endpoints, etc.). */
  data: Record<string, unknown>;
  style?: Record<string, unknown>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** A serialized board snapshot — what the REST API returns / accepts. */
export interface BoardSnapshot {
  schemaVersion: number;
  objects: BoardObjectBase[];
  /** Connectors reference object ids; kept denormalized for fast traversal. */
  edges: BoardEdge[];
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  data?: Record<string, unknown>;
}

export const BOARD_SCHEMA_VERSION = 1;

export function emptyBoardSnapshot(): BoardSnapshot {
  return { schemaVersion: BOARD_SCHEMA_VERSION, objects: [], edges: [] };
}

/** Presence broadcast over the realtime channel (ephemeral, not persisted). */
export interface PresenceState {
  userId: string;
  name: string;
  color: string;
  cursor?: Point | null;
  selection?: string[];
  lastActiveAt: number;
}

/**
 * Concrete, already-resolved board mutations produced by the AI command agent.
 * The server applies these to the persisted snapshot and returns them so the
 * client can apply the identical changes to the live (Yjs) document.
 */
export type AppliedBoardOp =
  | { kind: 'add'; object: BoardObjectBase }
  | {
      kind: 'update';
      id: string;
      data?: Record<string, unknown>;
      style?: Record<string, unknown>;
      position?: Point;
    }
  | { kind: 'delete'; ids: string[] }
  | { kind: 'connect'; edge: BoardEdge };

export interface BoardCommandResult {
  /** Natural-language summary of what the agent did. */
  reply: string;
  operations: AppliedBoardOp[];
}

