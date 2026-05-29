import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Permission } from '@ai-board/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { DocumentsService } from './documents.service';

/** Multipart file part exposed by @fastify/multipart's `request.file()`. */
interface MultipartFile {
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
}
type MultipartRequest = FastifyRequest & { file: () => Promise<MultipartFile | undefined> };

@Controller('workspaces/:workspaceId/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** Upload a document (PDF/DOCX/TXT/MD/CSV/JSON/image). Field name: `file`. */
  @Post()
  @RequirePermissions(Permission.AI_USE)
  async upload(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Req() req: MultipartRequest,
  ) {
    if (typeof req.file !== 'function') {
      throw new BadRequestException('Expected multipart/form-data with a "file" field');
    }
    const file = await req.file();
    if (!file) throw new BadRequestException('No file uploaded');
    const buffer = await file.toBuffer();
    return this.documents.upload(userId, workspaceId, {
      filename: file.filename,
      mimeType: file.mimetype,
      buffer,
    });
  }

  @Get()
  @RequirePermissions(Permission.WORKSPACE_VIEW)
  list(@Param('workspaceId') workspaceId: string) {
    return this.documents.list(workspaceId);
  }

  @Get(':documentId')
  @RequirePermissions(Permission.WORKSPACE_VIEW)
  async get(@Param('workspaceId') workspaceId: string, @Param('documentId') documentId: string) {
    const doc = await this.documents.get(documentId);
    if (doc.workspaceId !== workspaceId) throw new ForbiddenException();
    return doc;
  }

  @Delete(':documentId')
  @HttpCode(204)
  @RequirePermissions(Permission.AI_USE)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    const doc = await this.documents.get(documentId);
    if (doc.workspaceId !== workspaceId) throw new ForbiddenException();
    await this.documents.remove(userId, workspaceId, documentId);
  }
}
