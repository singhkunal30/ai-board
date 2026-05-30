// Mobile-local mirror of the API contracts (kept self-contained so the Expo
// app builds without the pnpm workspace). Must stay in sync with
// packages/shared on the backend.

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
}

export interface Board {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  visibility: 'PRIVATE' | 'WORKSPACE';
  isArchived: boolean;
  version: number;
  snapshot?: BoardSnapshot;
  updatedAt: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface BoardObjectBase {
  id: string;
  type: string;
  position: Point;
  size: { width: number; height: number };
  zIndex: number;
  data: Record<string, unknown>;
  style?: Record<string, unknown>;
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface BoardSnapshot {
  schemaVersion: number;
  objects: BoardObjectBase[];
  edges: BoardEdge[];
}

export type AppliedBoardOp =
  | { kind: 'add'; object: BoardObjectBase }
  | { kind: 'update'; id: string; data?: Record<string, unknown>; style?: Record<string, unknown>; position?: Point }
  | { kind: 'delete'; ids: string[] }
  | { kind: 'connect'; edge: BoardEdge };

export interface BoardCommandResult {
  reply: string;
  operations: AppliedBoardOp[];
}

/** Read the display text from a board object's free-form data. */
export function objectText(obj: BoardObjectBase): string {
  const d = obj.data ?? {};
  for (const k of ['text', 'label', 'content', 'title']) {
    const v = d[k];
    if (typeof v === 'string') return v;
  }
  return '';
}
