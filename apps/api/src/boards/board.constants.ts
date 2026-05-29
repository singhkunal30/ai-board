export { BoardObjectType, BoardRole } from '@ai-board/shared';

/** Mirrors the Prisma `BoardVisibility` enum for use in zod schemas. */
export const BoardVisibility = {
  PRIVATE: 'PRIVATE',
  WORKSPACE: 'WORKSPACE',
} as const;
export type BoardVisibility = (typeof BoardVisibility)[keyof typeof BoardVisibility];
