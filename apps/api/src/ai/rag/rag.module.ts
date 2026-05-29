import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

/** Exposes the RAG vector store app-wide (board AI, documents, …). */
@Global()
@Module({
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class RagModule {}
