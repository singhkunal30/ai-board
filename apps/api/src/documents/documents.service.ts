import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Document } from '@prisma/client';
import { EmbeddingSourceType } from '@ai-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { EmbeddingService } from '../ai/rag/embedding.service';
import { extractText, isSupported } from './parsers';

export interface UploadInput {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly embeddings: EmbeddingService,
    private readonly audit: AuditService,
  ) {}

  async upload(actorId: string, workspaceId: string, file: UploadInput): Promise<Document> {
    if (!isSupported(file.mimeType, file.filename)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimeType}`);
    }

    const storageKey = this.storage.key(workspaceId, file.filename);
    await this.storage.put(storageKey, file.buffer, file.mimeType);

    const doc = await this.prisma.document.create({
      data: {
        workspaceId,
        uploadedById: actorId,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        storageKey,
        status: 'PENDING',
      },
    });

    await this.audit.record(this.prisma, {
      workspaceId,
      actorId,
      action: 'document.upload',
      targetType: 'document',
      targetId: doc.id,
      metadata: { filename: file.filename },
    });

    // Process inline (parse → embed). At larger scale this moves to a queue.
    void this.process(doc.id, workspaceId, file);
    return doc;
  }

  private async process(documentId: string, workspaceId: string, file: UploadInput): Promise<void> {
    await this.prisma.document.update({ where: { id: documentId }, data: { status: 'PROCESSING' } });
    try {
      const text = await extractText(file.buffer, file.mimeType, file.filename);
      if (text.trim()) {
        await this.embeddings.indexUnits(workspaceId, null, [
          {
            sourceType: EmbeddingSourceType.DOCUMENT_CHUNK,
            sourceId: documentId,
            content: text,
            metadata: { filename: file.filename, documentId },
          },
        ]);
      }
      await this.prisma.document.update({ where: { id: documentId }, data: { status: 'READY' } });
    } catch (err) {
      this.logger.error(`Failed to process document ${documentId}`, err as Error);
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', error: (err as Error).message.slice(0, 500) },
      });
    }
  }

  list(workspaceId: string): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(documentId: string): Promise<Document> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(actorId: string, workspaceId: string, documentId: string): Promise<void> {
    const doc = await this.get(documentId);
    await this.storage.delete(doc.storageKey).catch(() => undefined);
    await this.embeddings.deleteForSources([documentId]);
    await this.prisma.document.delete({ where: { id: documentId } });
    await this.audit.record(this.prisma, {
      workspaceId,
      actorId,
      action: 'document.delete',
      targetType: 'document',
      targetId: documentId,
    });
  }
}
