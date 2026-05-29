import type { WorkspaceRole } from '@ai-board/shared';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: WorkspaceRole;
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
  updatedAt: string;
}
