import { Module } from '@nestjs/common';
import { BoardsModule } from '../../boards/boards.module';
import { EmbeddingService } from '../rag/embedding.service';
import { AgentController } from '../agents/agent.controller';
import { AgentService } from '../agents/agent.service';
import { BoardAiController } from './board-ai.controller';
import { BoardAiService } from './board-ai.service';

/**
 * Board-level AI features (generation, analysis, RAG chat) and the specialized
 * agent system. Depends on the global AiModule (AiService) and BoardsModule
 * (snapshot persistence).
 */
@Module({
  imports: [BoardsModule],
  controllers: [BoardAiController, AgentController],
  providers: [BoardAiService, EmbeddingService, AgentService],
  exports: [BoardAiService, EmbeddingService, AgentService],
})
export class BoardAiModule {}
