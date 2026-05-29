import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AgentKind, BoardObjectBase, BoardObjectType } from '@ai-board/shared';
import { AiService } from '../ai.service';
import { BoardAiService } from '../features/board-ai.service';
import { DiagramSpec, GeneratedFragment, layoutDiagram, layoutStickyGrid, textNode } from '../features/layout.util';
import { DIAGRAM_SYSTEM, PM_AGENT_SYSTEM, SCRUM_AGENT_SYSTEM } from '../features/prompts';

export interface AgentResult {
  kind: AgentKind;
  /** Free-text output (e.g. a PRD), when the agent produces prose. */
  text?: string;
  /** Objects/edges added to the board, when the agent produces canvas content. */
  fragment?: GeneratedFragment;
  /** Structured payload (e.g. scrum stories), when applicable. */
  data?: unknown;
}

interface Story {
  title: string;
  points?: number;
  priority?: string;
}

/**
 * Specialized agents that act like teammates. Each agent owns a system prompt
 * and decides how its output lands on the board (a PRD document, an
 * architecture diagram, a backlog of stories, or research notes).
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly ai: AiService,
    private readonly boardAi: BoardAiService,
  ) {}

  async run(actorId: string, boardId: string, kind: AgentKind, prompt: string): Promise<AgentResult> {
    switch (kind) {
      case AgentKind.PRODUCT_MANAGER:
        return this.productManager(actorId, boardId, prompt);
      case AgentKind.ARCHITECT:
        return this.architect(actorId, boardId, prompt);
      case AgentKind.SCRUM:
        return this.scrum(actorId, boardId, prompt);
      case AgentKind.RESEARCH: {
        const { research, fragment } = await this.boardAi.research(actorId, boardId);
        return { kind, data: research, fragment };
      }
      case AgentKind.ASSISTANT: {
        const text = (await this.ai.chat([{ role: 'user', content: prompt }])).content;
        return { kind, text };
      }
      default:
        throw new BadRequestException(`Unknown agent: ${kind as string}`);
    }
  }

  private async productManager(actorId: string, boardId: string, prompt: string): Promise<AgentResult> {
    const text = (
      await this.ai.chat([
        { role: 'system', content: PM_AGENT_SYSTEM },
        { role: 'user', content: prompt },
      ])
    ).content;

    const fragment = await this.boardAi.appendBuilt(actorId, boardId, (origin) => {
      const doc: BoardObjectBase = {
        id: randomUUID(),
        type: BoardObjectType.MARKDOWN,
        position: { x: origin.x, y: origin.y },
        size: { width: 460, height: 600 },
        zIndex: 1,
        data: { content: text, title: 'PRD' },
        style: { background: '#ffffff' },
      };
      return { objects: [textNode('PRD', origin.x, origin.y - 60, { fontSize: 22 }), doc], edges: [] };
    });
    return { kind: AgentKind.PRODUCT_MANAGER, text, fragment };
  }

  private async architect(actorId: string, boardId: string, prompt: string): Promise<AgentResult> {
    const spec = await this.ai.chatJson<DiagramSpec>([
      { role: 'system', content: DIAGRAM_SYSTEM },
      { role: 'user', content: prompt },
    ]);
    const fragment = await this.boardAi.appendBuilt(actorId, boardId, (origin) =>
      layoutDiagram(spec, origin),
    );
    return { kind: AgentKind.ARCHITECT, fragment, data: spec };
  }

  private async scrum(actorId: string, boardId: string, prompt: string): Promise<AgentResult> {
    const parsed = await this.ai.chatJson<{ stories: Story[] }>([
      { role: 'system', content: SCRUM_AGENT_SYSTEM },
      { role: 'user', content: prompt },
    ]);
    const stories = Array.isArray(parsed.stories) ? parsed.stories : [];
    const fragment = await this.boardAi.appendBuilt(actorId, boardId, (origin) => {
      const labels = stories.map(
        (s) => `${s.title}${s.points ? ` (${s.points} pts)` : ''}${s.priority ? ` · ${s.priority}` : ''}`,
      );
      const grid = layoutStickyGrid(labels, origin, 3, '#fde68a');
      return { objects: [textNode('Backlog', origin.x, origin.y - 60, { fontSize: 22 }), ...grid.objects], edges: [] };
    });
    return { kind: AgentKind.SCRUM, data: stories, fragment };
  }
}
