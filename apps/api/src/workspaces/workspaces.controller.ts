import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Permission } from '@ai-board/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { WorkspaceCtx } from '../authz/access-context.decorator';
import { WorkspaceAccess } from '../authz/access-control.service';
import { WorkspacesService } from './workspaces.service';
import {
  AddMemberInput,
  addMemberSchema,
  CreateWorkspaceInput,
  createWorkspaceSchema,
  UpdateMemberInput,
  updateMemberSchema,
  UpdateWorkspaceInput,
  updateWorkspaceSchema,
} from './workspaces.schemas';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createWorkspaceSchema)) dto: CreateWorkspaceInput,
  ) {
    return this.workspaces.create(userId, dto);
  }

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.workspaces.listForUser(userId);
  }

  @Get(':workspaceId')
  @RequirePermissions(Permission.WORKSPACE_VIEW)
  get(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.get(workspaceId);
  }

  @Patch(':workspaceId')
  @RequirePermissions(Permission.WORKSPACE_UPDATE)
  update(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(updateWorkspaceSchema)) dto: UpdateWorkspaceInput,
  ) {
    return this.workspaces.update(userId, workspaceId, dto);
  }

  @Delete(':workspaceId')
  @HttpCode(204)
  @RequirePermissions(Permission.WORKSPACE_DELETE)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
  ): Promise<void> {
    await this.workspaces.softDelete(userId, workspaceId);
  }

  @Get(':workspaceId/members')
  @RequirePermissions(Permission.WORKSPACE_VIEW)
  members(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Post(':workspaceId/members')
  @RequirePermissions(Permission.WORKSPACE_MANAGE_MEMBERS)
  addMember(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(addMemberSchema)) dto: AddMemberInput,
  ) {
    return this.workspaces.addMember(userId, workspaceId, dto);
  }

  @Patch(':workspaceId/members/:userId')
  @RequirePermissions(Permission.WORKSPACE_MANAGE_MEMBERS)
  updateMember(
    @CurrentUser('id') actorId: string,
    @WorkspaceCtx() ctx: WorkspaceAccess,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) dto: UpdateMemberInput,
  ) {
    return this.workspaces.updateMember(actorId, ctx.role, workspaceId, targetUserId, dto);
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(204)
  @RequirePermissions(Permission.WORKSPACE_MANAGE_MEMBERS)
  async removeMember(
    @CurrentUser('id') actorId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    await this.workspaces.removeMember(actorId, workspaceId, targetUserId);
  }
}
