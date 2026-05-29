import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Permission } from '@ai-board/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BoardsService } from './boards.service';
import {
  AddBoardMemberInput,
  addBoardMemberSchema,
  BoardSnapshotInput,
  boardSnapshotSchema,
  CreateBoardInput,
  createBoardSchema,
  UpdateBoardInput,
  updateBoardSchema,
} from './boards.schemas';

/** Workspace-scoped board routes (create / list within a workspace). */
@Controller('workspaces/:workspaceId/boards')
export class WorkspaceBoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Post()
  @RequirePermissions(Permission.BOARD_CREATE)
  create(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(createBoardSchema)) dto: CreateBoardInput,
  ) {
    return this.boards.create(userId, workspaceId, dto);
  }

  @Get()
  @RequirePermissions(Permission.BOARD_VIEW)
  list(
    @Param('workspaceId') workspaceId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.boards.listForWorkspace(workspaceId, includeArchived === 'true');
  }
}

/** Board-scoped routes. Access resolved from the `:boardId` param. */
@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get(':boardId')
  @RequirePermissions(Permission.BOARD_VIEW)
  get(@Param('boardId') boardId: string) {
    return this.boards.get(boardId);
  }

  @Patch(':boardId')
  @RequirePermissions(Permission.BOARD_UPDATE)
  update(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(updateBoardSchema)) dto: UpdateBoardInput,
  ) {
    return this.boards.update(userId, boardId, dto);
  }

  @Put(':boardId/snapshot')
  @RequirePermissions(Permission.CONTENT_EDIT)
  saveSnapshot(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(boardSnapshotSchema)) snapshot: BoardSnapshotInput,
  ) {
    return this.boards.saveSnapshot(userId, boardId, snapshot);
  }

  @Post(':boardId/duplicate')
  @RequirePermissions(Permission.BOARD_UPDATE)
  duplicate(@CurrentUser('id') userId: string, @Param('boardId') boardId: string) {
    return this.boards.duplicate(userId, boardId);
  }

  @Post(':boardId/archive')
  @RequirePermissions(Permission.BOARD_UPDATE)
  archive(@CurrentUser('id') userId: string, @Param('boardId') boardId: string) {
    return this.boards.setArchived(userId, boardId, true);
  }

  @Post(':boardId/unarchive')
  @RequirePermissions(Permission.BOARD_UPDATE)
  unarchive(@CurrentUser('id') userId: string, @Param('boardId') boardId: string) {
    return this.boards.setArchived(userId, boardId, false);
  }

  @Get(':boardId/export')
  @RequirePermissions(Permission.BOARD_EXPORT)
  export(@Param('boardId') boardId: string) {
    return this.boards.export(boardId);
  }

  @Post(':boardId/members')
  @RequirePermissions(Permission.BOARD_SHARE)
  addMember(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(addBoardMemberSchema)) dto: AddBoardMemberInput,
  ) {
    return this.boards.addMember(userId, boardId, dto);
  }

  @Delete(':boardId')
  @HttpCode(204)
  @RequirePermissions(Permission.BOARD_DELETE)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
  ): Promise<void> {
    await this.boards.softDelete(userId, boardId);
  }
}
