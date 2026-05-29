import { Module } from '@nestjs/common';
import { BoardsModule } from '../../boards/boards.module';
import { EmbeddingService } from '../rag/embedding.service';
import { BoardAiController } from './board-ai.controller';
import { BoardAiService } from './board-ai.service';

/**
 * Board-level AI features (generation, analysis, RAG chat). Depends on the
 * global AiModule (AiService) and BoardsModule (snapshot persistence).
 */
@Module({
  imports: [BoardsModule],
  controllers: [BoardAiController],
  providers: [BoardAiService, EmbeddingService],
  exports: [BoardAiService, EmbeddingService],
})
export class BoardAiModule {}
