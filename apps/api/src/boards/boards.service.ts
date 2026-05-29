import { Injectable, NotFoundException } from '@nestjs/common';
import type { Board, Prisma } from '@prisma/client';
import { emptyBoardSnapshot } from '@ai-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AddBoardMemberInput,
  BoardSnapshotInput,
  CreateBoardInput,
  UpdateBoardInput,
} from './boards.schemas';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(actorId: string, workspaceId: string, input: CreateBoardInput): Promise<Board> {
    const board = await this.prisma.board.create({
      data: {
        workspaceId,
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        createdById: actorId,
        snapshot: emptyBoardSnapshot() as unknown as Prisma.InputJsonValue,
        // Creator gets an explicit editor grant so PRIVATE boards remain
        // reachable by their author.
        members: { create: { userId: actorId, role: 'EDITOR' } },
      },
    });
    await this.audit.record(this.prisma, {
      workspaceId,
      actorId,
      action: 'board.create',
      targetType: 'board',
      targetId: board.id,
    });
    return board;
  }

  listForWorkspace(workspaceId: string, includeArchived = false): Promise<Board[]> {
    return this.prisma.board.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(boardId: string): Promise<Board> {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, deletedAt: null },
    });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  async update(actorId: string, boardId: string, input: UpdateBoardInput): Promise<Board> {
    await this.get(boardId);
    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: {
        title: input.title,
        description: input.description,
        visibility: input.visibility,
      },
    });
    await this.audit.record(this.prisma, {
      workspaceId: board.workspaceId,
      actorId,
      action: 'board.update',
      targetType: 'board',
      targetId: boardId,
    });
    return board;
  }

  /**
   * Persists a board snapshot supplied over REST. Realtime edits are persisted
   * separately by the CRDT gateway; this path supports non-collaborative saves,
   * imports and AI-generated content.
   */
  async saveSnapshot(
    actorId: string,
    boardId: string,
    snapshot: BoardSnapshotInput,
  ): Promise<Board> {
    const existing = await this.get(boardId);
    return this.prisma.board.update({
      where: { id: boardId },
      data: {
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        version: existing.version + 1,
      },
    });
  }

  async duplicate(actorId: string, boardId: string): Promise<Board> {
    const source = await this.get(boardId);
    const copy = await this.prisma.board.create({
      data: {
        workspaceId: source.workspaceId,
        title: `${source.title} (copy)`,
        description: source.description,
        visibility: source.visibility,
        createdById: actorId,
        snapshot: source.snapshot as Prisma.InputJsonValue,
        members: { create: { userId: actorId, role: 'EDITOR' } },
      },
    });
    await this.audit.record(this.prisma, {
      workspaceId: source.workspaceId,
      actorId,
      action: 'board.duplicate',
      targetType: 'board',
      targetId: copy.id,
      metadata: { sourceBoardId: boardId },
    });
    return copy;
  }

  async setArchived(actorId: string, boardId: string, archived: boolean): Promise<Board> {
    const existing = await this.get(boardId);
    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: { isArchived: archived },
    });
    await this.audit.record(this.prisma, {
      workspaceId: existing.workspaceId,
      actorId,
      action: archived ? 'board.archive' : 'board.unarchive',
      targetType: 'board',
      targetId: boardId,
    });
    return board;
  }

  async softDelete(actorId: string, boardId: string): Promise<void> {
    const existing = await this.get(boardId);
    await this.prisma.board.update({
      where: { id: boardId },
      data: { deletedAt: new Date() },
    });
    await this.audit.record(this.prisma, {
      workspaceId: existing.workspaceId,
      actorId,
      action: 'board.delete',
      targetType: 'board',
      targetId: boardId,
    });
  }

  async export(boardId: string) {
    const board = await this.get(boardId);
    return {
      id: board.id,
      title: board.title,
      description: board.description,
      version: board.version,
      exportedAt: new Date().toISOString(),
      snapshot: board.snapshot,
    };
  }

  async addMember(actorId: string, boardId: string, input: AddBoardMemberInput) {
    const board = await this.get(boardId);
    const member = await this.prisma.boardMember.upsert({
      where: { boardId_userId: { boardId, userId: input.userId } },
      create: { boardId, userId: input.userId, role: input.role },
      update: { role: input.role },
    });
    await this.audit.record(this.prisma, {
      workspaceId: board.workspaceId,
      actorId,
      action: 'board.member.add',
      targetType: 'board',
      targetId: boardId,
      metadata: { userId: input.userId, role: input.role },
    });
    return member;
  }
}
