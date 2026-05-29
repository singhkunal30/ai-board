import { z } from 'zod';
import { WorkspaceRole } from '@ai-board/shared';

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  settings: z.record(z.unknown()).optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.nativeEnum(WorkspaceRole),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
