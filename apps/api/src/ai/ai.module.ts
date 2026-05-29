import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiProviderFactory } from './ai.provider';
import { AiService } from './ai.service';

/**
 * Provides the AI facade app-wide. Marked @Global so feature modules can inject
 * `AiService` without importing AiModule explicitly.
 */
@Global()
@Module({
  controllers: [AiController],
  providers: [AiProviderFactory, AiService],
  exports: [AiService],
})
export class AiModule {}
