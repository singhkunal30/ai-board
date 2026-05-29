import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ChatResult, ModelInfo } from '@ai-board/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AiService } from './ai.service';
import { ChatRequestInput, chatRequestSchema } from './ai.schemas';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Liveness of the configured LLM runtime. */
  @Get('health')
  async health(): Promise<{ healthy: boolean }> {
    return { healthy: await this.ai.health() };
  }

  /** Models advertised by the runtime — used to populate model pickers. */
  @Get('models')
  models(): Promise<ModelInfo[]> {
    return this.ai.listModels();
  }

  /** Non-streaming chat completion. */
  @Post('chat')
  chat(@Body(new ZodValidationPipe(chatRequestSchema)) dto: ChatRequestInput): Promise<ChatResult> {
    return this.ai.chat(dto.messages, {
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
    });
  }

  /** Streaming chat completion as Server-Sent Events. */
  @Post('chat/stream')
  async chatStream(
    @Body(new ZodValidationPipe(chatRequestSchema)) dto: ChatRequestInput,
    @Res() res: FastifyReply,
  ): Promise<void> {
    res.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    try {
      for await (const chunk of this.ai.chatStream(dto.messages, {
        model: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
      })) {
        res.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.done) break;
      }
      res.raw.write('data: [DONE]\n\n');
    } catch (err) {
      res.raw.write(
        `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
      );
    } finally {
      res.raw.end();
    }
  }
}
