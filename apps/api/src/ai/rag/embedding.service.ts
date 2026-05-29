import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmbeddingSourceType } from '@ai-board/shared';
import { APP_CONFIG } from '../../config/config.module';
import { Config } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai.service';
import { chunkText } from './chunker';

export interface IndexUnit {
  sourceType: EmbeddingSourceType;
  sourceId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchHit {
  id: string;
  content: string;
  sourceType: EmbeddingSourceType;
  sourceId: string;
  boardId: string | null;
  score: number;
}

/**
 * RAG vector store on top of pgvector. Handles chunking, embedding, persistence
 * and cosine similarity search. pgvector operators sit outside Prisma's typed
 * surface, so writes/reads of the `vector` column use raw SQL with parameter
 * binding (no string interpolation of user data).
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    @Inject(APP_CONFIG) private readonly config: Config,
  ) {}

  private toVectorLiteral(values: number[]): string {
    return `[${values.join(',')}]`;
  }

  /** Replaces all embeddings for the given sources, then indexes fresh content. */
  async indexUnits(
    workspaceId: string,
    boardId: string | null,
    units: IndexUnit[],
  ): Promise<number> {
    if (units.length === 0) return 0;

    // Expand each unit into chunks, embed in one batch.
    const expanded = units.flatMap((u) =>
      chunkText(u.content).map((c) => ({
        sourceType: u.sourceType,
        sourceId: u.sourceId,
        chunkIndex: c.index,
        content: c.content,
        metadata: u.metadata ?? {},
      })),
    );
    if (expanded.length === 0) return 0;

    const { embeddings, dimensions } = await this.ai.embed(expanded.map((e) => e.content));
    if (dimensions !== this.config.ai.embeddingDimensions) {
      throw new Error(
        `Embedding dimension mismatch: model returned ${dimensions}, schema expects ${this.config.ai.embeddingDimensions}. ` +
          `Set AI_DEFAULT_EMBEDDING_MODEL to a ${this.config.ai.embeddingDimensions}-dim model or migrate the vector column.`,
      );
    }

    const sourceIds = [...new Set(expanded.map((e) => e.sourceId))];

    await this.prisma.$transaction(async (tx) => {
      // Clear prior vectors for these sources (idempotent re-index).
      await tx.$executeRaw`DELETE FROM "embeddings" WHERE "sourceId" IN (${Prisma.join(sourceIds)})`;
      for (let i = 0; i < expanded.length; i++) {
        const e = expanded[i];
        const vec = this.toVectorLiteral(embeddings[i]);
        await tx.$executeRaw`
          INSERT INTO "embeddings"
            ("id","workspaceId","boardId","sourceType","sourceId","chunkIndex","content","metadata","embedding","createdAt")
          VALUES (
            gen_random_uuid(), ${workspaceId}::uuid, ${boardId}::uuid,
            ${e.sourceType}::"EmbeddingSourceType", ${e.sourceId}, ${e.chunkIndex},
            ${e.content}, ${JSON.stringify(e.metadata)}::jsonb, ${vec}::vector, now()
          )`;
      }
    });

    this.logger.debug(`Indexed ${expanded.length} chunks for ${sourceIds.length} sources`);
    return expanded.length;
  }

  /** Cosine-similarity search scoped to a workspace (optionally a board / source type). */
  async search(
    workspaceId: string,
    query: string,
    opts: { boardId?: string; limit?: number; sourceType?: EmbeddingSourceType } = {},
  ): Promise<SearchHit[]> {
    const limit = Math.min(opts.limit ?? 8, 50);
    const { embeddings } = await this.ai.embed([query]);
    const vec = this.toVectorLiteral(embeddings[0]);

    const boardFilter = opts.boardId
      ? Prisma.sql`AND "boardId" = ${opts.boardId}::uuid`
      : Prisma.empty;
    const typeFilter = opts.sourceType
      ? Prisma.sql`AND "sourceType" = ${opts.sourceType}::"EmbeddingSourceType"`
      : Prisma.empty;

    return this.prisma.$queryRaw<SearchHit[]>`
      SELECT "id", "content", "sourceType", "sourceId", "boardId",
             1 - ("embedding" <=> ${vec}::vector) AS "score"
      FROM "embeddings"
      WHERE "workspaceId" = ${workspaceId}::uuid AND "embedding" IS NOT NULL ${boardFilter} ${typeFilter}
      ORDER BY "embedding" <=> ${vec}::vector
      LIMIT ${limit}`;
  }

  async deleteForBoard(boardId: string): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM "embeddings" WHERE "boardId" = ${boardId}::uuid`;
  }

  async deleteForSources(sourceIds: string[]): Promise<void> {
    if (sourceIds.length === 0) return;
    await this.prisma.$executeRaw`DELETE FROM "embeddings" WHERE "sourceId" IN (${Prisma.join(sourceIds)})`;
  }
}
