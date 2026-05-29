import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCommentInput {
  body: string;
  objectId?: string | null;
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(actorId: string, boardId: string, input: CreateCommentInput) {
    return this.prisma.comment.create({
      data: {
        boardId,
        authorId: actorId,
        body: input.body,
        objectId: input.objectId ?? null,
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  list(boardId: string) {
    return this.prisma.comment.findMany({
      where: { boardId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async update(
    actorId: string,
    commentId: string,
    patch: { body?: string; resolved?: boolean },
  ) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    // Editing the text is author-only; resolving is open to any board commenter.
    if (patch.body !== undefined && comment.authorId !== actorId) {
      throw new ForbiddenException('Only the author can edit a comment');
    }
    return this.prisma.comment.update({
      where: { id: commentId },
      data: {
        body: patch.body,
        resolvedAt:
          patch.resolved === undefined ? undefined : patch.resolved ? new Date() : null,
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async remove(actorId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== actorId) {
      throw new ForbiddenException('Only the author can delete a comment');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
