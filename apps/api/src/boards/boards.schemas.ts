import { z } from 'zod';
import { BoardObjectType, BoardRole, BoardVisibility } from './board.constants';

export const createBoardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  visibility: z.nativeEnum(BoardVisibility).default(BoardVisibility.WORKSPACE),
});
export type CreateBoardInput = z.infer<typeof createBoardSchema>;

export const updateBoardSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: z.nativeEnum(BoardVisibility).optional(),
});
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

const pointSchema = z.object({ x: z.number(), y: z.number() });
const sizeSchema = z.object({ width: z.number(), height: z.number() });

export const boardObjectSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(BoardObjectType),
  position: pointSchema,
  size: sizeSchema,
  rotation: z.number().optional(),
  zIndex: z.number(),
  parentId: z.string().nullable().optional(),
  data: z.record(z.unknown()),
  style: z.record(z.unknown()).optional(),
});

export const boardEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export const boardSnapshotSchema = z.object({
  schemaVersion: z.number().int().positive(),
  objects: z.array(boardObjectSchema).max(50_000),
  edges: z.array(boardEdgeSchema).max(50_000),
});
export type BoardSnapshotInput = z.infer<typeof boardSnapshotSchema>;

export const addBoardMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(BoardRole).default(BoardRole.EDITOR),
});
export type AddBoardMemberInput = z.infer<typeof addBoardMemberSchema>;
