import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Workspace } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { WORKSPACE_ROLE_RANK, WorkspaceRole } from '@ai-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AddMemberInput,
  CreateWorkspaceInput,
  UpdateMemberInput,
  UpdateWorkspaceInput,
} from './workspaces.schemas';

const slugId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, input: CreateWorkspaceInput): Promise<Workspace> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          slug: `${slugify(input.name)}-${slugId()}`,
          ownerId: userId,
          members: { create: { userId, role: WorkspaceRole.OWNER } },
        },
      });
      await this.audit.record(tx, {
        workspaceId: workspace.id,
        actorId: userId,
        action: 'workspace.create',
        targetType: 'workspace',
        targetId: workspace.id,
      });
      return workspace;
    });
  }

  /** Workspaces the user is a member of. */
  async listForUser(userId: string): Promise<(Workspace & { role: WorkspaceRole })[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, workspace: { deletedAt: null } },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role as WorkspaceRole }));
  }

  async get(workspaceId: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async update(
    actorId: string,
    workspaceId: string,
    input: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    await this.get(workspaceId);
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: input.name,
        settings: input.settings as object | undefined,
      },
    });
    await this.audit.record(this.prisma, {
      workspaceId,
      actorId,
      action: 'workspace.update',
      targetType: 'workspace',
      targetId: workspaceId,
    });
    return workspace;
  }

  async softDelete(actorId: string, workspaceId: string): Promise<void> {
    await this.get(workspaceId);
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
    await this.audit.record(this.prisma, {
      workspaceId,
      actorId,
      action: 'workspace.delete',
      targetType: 'workspace',
      targetId: workspaceId,
    });
  }

  async listMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(actorId: string, workspaceId: string, input: AddMemberInput) {
    if (input.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Use ownership transfer to assign OWNER');
    }
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new NotFoundException('No user with that email');

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existing) throw new BadRequestException('User is already a member');

    const member = await this.prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: input.role },
    });
    await this.audit.record(this.prisma, {
      workspaceId,
      actorId,
      action: 'workspace.member.add',
      targetType: 'user',
      targetId: user.id,
      metadata: { role: input.role },
    });
    return member;
  }

  async updateMember(
    actorId: string,
    actorRole: WorkspaceRole,
    workspaceId: string,
    targetUserId: string,
    input: UpdateMemberInput,
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot change the role of the workspace owner');
    }
    // An admin cannot grant a role higher than their own.
    if (WORKSPACE_ROLE_RANK[input.role] > WORKSPACE_ROLE_RANK[actorRole]) {
      throw new ForbiddenException('Cannot assign a role higher than your own');
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role: input.role },
    });
    await this.audit.record(this.prisma, {
      workspaceId,
      actorId,
      action: 'workspace.member.update',
      targetType: 'user',
      targetId: targetUserId,
      metadata: { role: input.role },
    });
    return updated;
  }

  async removeMember(actorId: string, workspaceId: string, targetUserId: string): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }
    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    await this.audit.record(this.prisma, {
      workspaceId,
      actorId,
      action: 'workspace.member.remove',
      targetType: 'user',
      targetId: targetUserId,
    });
  }
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'workspace'
  );
}
