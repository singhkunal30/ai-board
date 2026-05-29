import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common';
import { AgentKind, Permission } from '@ai-board/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AgentInput, agentSchema } from '../features/board-ai.schemas';
import { AgentService } from './agent.service';

const VALID_KINDS = new Set<string>(Object.values(AgentKind));

/** Specialized AI agents acting on a board. */
@Controller('boards/:boardId/ai/agents')
export class AgentController {
  constructor(private readonly agents: AgentService) {}

  @Post(':kind')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  run(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Param('kind') kind: string,
    @Body(new ZodValidationPipe(agentSchema)) dto: AgentInput,
  ) {
    if (!VALID_KINDS.has(kind)) {
      throw new BadRequestException(`Unknown agent kind: ${kind}`);
    }
    return this.agents.run(userId, boardId, kind as AgentKind, dto.prompt);
  }
}
