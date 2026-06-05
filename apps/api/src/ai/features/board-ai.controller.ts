import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Permission } from '@ai-board/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BoardAiService } from './board-ai.service';
import {
  BoardChatInput,
  boardChatSchema,
  CommandInput,
  commandSchema,
  GeneratePromptInput,
  generatePromptSchema,
  MeetingInput,
  meetingSchema,
  VisionInput,
  visionSchema,
} from './board-ai.schemas';

/** Board-scoped AI features. Mutating features need CONTENT_EDIT; read-only need AI_USE. */
@Controller('boards/:boardId/ai')
export class BoardAiController {
  constructor(private readonly boardAi: BoardAiService) {}

  @Post('mindmap')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  mindmap(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(generatePromptSchema)) dto: GeneratePromptInput,
  ) {
    return this.boardAi.generateMindMap(userId, boardId, dto.prompt);
  }

  @Post('diagram')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  diagram(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(generatePromptSchema)) dto: GeneratePromptInput,
  ) {
    return this.boardAi.generateDiagram(userId, boardId, dto.prompt);
  }

  @Post('cluster')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  cluster(@CurrentUser('id') userId: string, @Param('boardId') boardId: string) {
    return this.boardAi.clusterNotes(userId, boardId);
  }

  @Get('summary')
  @RequirePermissions(Permission.AI_USE)
  summary(@Param('boardId') boardId: string) {
    return this.boardAi.summarize(boardId);
  }

  @Get('tasks')
  @RequirePermissions(Permission.AI_USE)
  tasks(@Param('boardId') boardId: string) {
    return this.boardAi.extractTasks(boardId);
  }

  @Post('index')
  @RequirePermissions(Permission.AI_USE)
  async index(@Param('boardId') boardId: string) {
    const chunks = await this.boardAi.indexBoard(boardId);
    return { indexedChunks: chunks };
  }

  @Post('chat')
  @RequirePermissions(Permission.AI_USE)
  chat(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(boardChatSchema)) dto: BoardChatInput,
  ) {
    return this.boardAi.chat(boardId, dto.message, dto.history);
  }

  @Post('meeting')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  meeting(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(meetingSchema)) dto: MeetingInput,
  ) {
    return this.boardAi.meetingMode(userId, boardId, dto.notes);
  }

  @Post('knowledge-graph')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  knowledgeGraph(@CurrentUser('id') userId: string, @Param('boardId') boardId: string) {
    return this.boardAi.knowledgeGraph(userId, boardId);
  }

  @Post('research')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  research(@CurrentUser('id') userId: string, @Param('boardId') boardId: string) {
    return this.boardAi.research(userId, boardId);
  }

  /** Multimodal: analyze an image and place the analysis on the board. */
  @Post('vision')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  vision(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(visionSchema)) dto: VisionInput,
  ) {
    return this.boardAi.vision(userId, boardId, dto.imageBase64, dto.prompt);
  }

  /** Natural-language board control: the agent edits the canvas for you. */
  @Post('command')
  @RequirePermissions(Permission.CONTENT_EDIT, Permission.AI_USE)
  command(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(commandSchema)) dto: CommandInput,
  ) {
    return this.boardAi.command(userId, boardId, dto.instruction, dto.history);
  }
}
