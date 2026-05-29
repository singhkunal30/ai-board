import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BoardRole,
  effectivePermissions,
  Permission,
  WorkspaceRole,
} from '@ai-board/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkspaceAccess {
  workspaceId: string;
  role: WorkspaceRole;
  permissions: Set<Permission>;
}

export interface BoardAccess {
  boardId: string;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
  boardRole: BoardRole | null;
  permissions: Set<Permission>;
}

/**
 * Central authority for "can user X do Y on resource Z". All permission
 * resolution lives here so guards, controllers, services and the realtime
 * gateway share one consistent model.
 */
@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      // Do not leak existence of workspaces the user can't see.
      throw new NotFoundException('Workspace not found');
    }
    const role = membership.role as WorkspaceRole;
    return { workspaceId, role, permissions: effectivePermissions(role) };
  }

  async getBoardAccess(userId: string, boardId: string): Promise<BoardAccess> {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, deletedAt: null },
      select: { id: true, workspaceId: true, visibility: true },
    });
    if (!board) throw new NotFoundException('Board not found');

    const [membership, boardMember] = await Promise.all([
      this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
      }),
      this.prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId } },
      }),
    ]);

    if (!membership) throw new NotFoundException('Board not found');

    const workspaceRole = membership.role as WorkspaceRole;
    const boardRole = (boardMember?.role as BoardRole | undefined) ?? null;

    // PRIVATE boards require an explicit board grant unless the caller is a
    // workspace admin/owner.
    if (
      board.visibility === 'PRIVATE' &&
      !boardRole &&
      workspaceRole !== WorkspaceRole.OWNER &&
      workspaceRole !== WorkspaceRole.ADMIN
    ) {
      throw new NotFoundException('Board not found');
    }

    return {
      boardId,
      workspaceId: board.workspaceId,
      workspaceRole,
      boardRole,
      permissions: effectivePermissions(workspaceRole, boardRole),
    };
  }

  /** Throws ForbiddenException unless `access` grants every required permission. */
  assertPermissions(
    access: { permissions: Set<Permission> },
    required: Permission[],
  ): void {
    const missing = required.filter((p) => !access.permissions.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
      );
    }
  }
}
