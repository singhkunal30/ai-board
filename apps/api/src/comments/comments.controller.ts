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
import { z } from 'zod';
import { Permission } from '@ai-board/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CommentsService } from './comments.service';

const createSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  objectId: z.string().max(128).nullable().optional(),
});
const updateSchema = z.object({
  body: z.string().trim().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
});

@Controller('boards/:boardId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @RequirePermissions(Permission.BOARD_VIEW)
  list(@Param('boardId') boardId: string) {
    return this.comments.list(boardId);
  }

  @Post()
  @RequirePermissions(Permission.CONTENT_COMMENT)
  create(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(createSchema)) dto: z.infer<typeof createSchema>,
  ) {
    return this.comments.create(userId, boardId, dto);
  }

  @Patch(':commentId')
  @RequirePermissions(Permission.CONTENT_COMMENT)
  update(
    @CurrentUser('id') userId: string,
    @Param('commentId') commentId: string,
    @Body(new ZodValidationPipe(updateSchema)) dto: z.infer<typeof updateSchema>,
  ) {
    return this.comments.update(userId, commentId, dto);
  }

  @Delete(':commentId')
  @HttpCode(204)
  @RequirePermissions(Permission.CONTENT_COMMENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    await this.comments.remove(userId, commentId);
  }
}
