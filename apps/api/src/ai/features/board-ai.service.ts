import { Injectable } from '@nestjs/common';
import {
  BoardSnapshot,
  ChatMessage,
  EmbeddingSourceType,
  emptyBoardSnapshot,
} from '@ai-board/shared';
import { BoardsService } from '../../boards/boards.service';
import { AiService } from '../ai.service';
import { EmbeddingService, SearchHit } from '../rag/embedding.service';
import { boardTextUnits, renderBoardForPrompt } from '../rag/board-content';
import {
  DiagramSpec,
  GeneratedFragment,
  layoutDiagram,
  layoutMindMap,
  layoutStickyGrid,
  MindMap,
} from './layout.util';
import {
  BOARD_CHAT_SYSTEM,
  CLUSTER_SYSTEM,
  DIAGRAM_SYSTEM,
  MINDMAP_SYSTEM,
  SUMMARY_SYSTEM,
  TASKS_SYSTEM,
} from './prompts';

export interface Task {
  title: string;
  priority: 'low' | 'medium' | 'high';
  suggestedOwner?: string;
  notes?: string;
}

export interface Cluster {
  label: string;
  items: string[];
}

/**
 * Implements the board-level AI capabilities: generation (mind maps, diagrams),
 * analysis (summary, tasks, clustering) and RAG-grounded board chat. Generation
 * features append laid-out objects to the board snapshot; analysis features are
 * read-only.
 */
@Injectable()
export class BoardAiService {
  constructor(
    private readonly boards: BoardsService,
    private readonly ai: AiService,
    private readonly embeddings: EmbeddingService,
  ) {}

  private async snapshotOf(boardId: string): Promise<{ workspaceId: string; snapshot: BoardSnapshot }> {
    const board = await this.boards.get(boardId);
    const snapshot = (board.snapshot as unknown as BoardSnapshot) ?? emptyBoardSnapshot();
    return { workspaceId: board.workspaceId, snapshot };
  }

  /** Right edge of existing content, so new fragments don't overlap. */
  private placementOrigin(snapshot: BoardSnapshot): { x: number; y: number } {
    if (snapshot.objects.length === 0) return { x: 0, y: 0 };
    const maxX = Math.max(...snapshot.objects.map((o) => o.position.x + o.size.width));
    const minY = Math.min(...snapshot.objects.map((o) => o.position.y));
    return { x: maxX + 400, y: minY };
  }

  private async appendFragment(
    actorId: string,
    boardId: string,
    snapshot: BoardSnapshot,
    fragment: GeneratedFragment,
  ): Promise<GeneratedFragment> {
    const merged: BoardSnapshot = {
      schemaVersion: snapshot.schemaVersion || 1,
      objects: [...snapshot.objects, ...fragment.objects],
      edges: [...snapshot.edges, ...fragment.edges],
    };
    await this.boards.saveSnapshot(actorId, boardId, merged as never);
    return fragment;
  }

  async generateMindMap(actorId: string, boardId: string, prompt: string): Promise<GeneratedFragment> {
    const { snapshot } = await this.snapshotOf(boardId);
    const map = await this.ai.chatJson<MindMap>([
      { role: 'system', content: MINDMAP_SYSTEM },
      { role: 'user', content: prompt },
    ]);
    const fragment = layoutMindMap(map, this.placementOrigin(snapshot));
    return this.appendFragment(actorId, boardId, snapshot, fragment);
  }

  async generateDiagram(actorId: string, boardId: string, prompt: string): Promise<GeneratedFragment> {
    const { snapshot } = await this.snapshotOf(boardId);
    const spec = await this.ai.chatJson<DiagramSpec>([
      { role: 'system', content: DIAGRAM_SYSTEM },
      { role: 'user', content: prompt },
    ]);
    const fragment = layoutDiagram(spec, this.placementOrigin(snapshot));
    return this.appendFragment(actorId, boardId, snapshot, fragment);
  }

  async summarize(boardId: string): Promise<{ summary: string }> {
    const { snapshot } = await this.snapshotOf(boardId);
    const rendered = renderBoardForPrompt(snapshot);
    if (!rendered.trim()) return { summary: 'The board is empty — add some content first.' };
    const result = await this.ai.chat([
      { role: 'system', content: SUMMARY_SYSTEM },
      { role: 'user', content: `Board contents:\n\n${rendered}` },
    ]);
    return { summary: result.content };
  }

  async extractTasks(boardId: string): Promise<{ tasks: Task[] }> {
    const { snapshot } = await this.snapshotOf(boardId);
    const rendered = renderBoardForPrompt(snapshot);
    if (!rendered.trim()) return { tasks: [] };
    const parsed = await this.ai.chatJson<{ tasks: Task[] }>([
      { role: 'system', content: TASKS_SYSTEM },
      { role: 'user', content: `Board contents:\n\n${rendered}` },
    ]);
    return { tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
  }

  /** Groups existing sticky notes into themed clusters and places labeled grids. */
  async clusterNotes(
    actorId: string,
    boardId: string,
  ): Promise<{ clusters: Cluster[]; fragment: GeneratedFragment }> {
    const { snapshot } = await this.snapshotOf(boardId);
    const units = boardTextUnits(snapshot);
    if (units.length === 0) return { clusters: [], fragment: { objects: [], edges: [] } };

    const parsed = await this.ai.chatJson<{ clusters: Cluster[] }>([
      { role: 'system', content: CLUSTER_SYSTEM },
      { role: 'user', content: `Ideas:\n${units.map((u) => `- ${u.content}`).join('\n')}` },
    ]);
    const clusters = Array.isArray(parsed.clusters) ? parsed.clusters : [];

    // Lay clusters out as labeled columns of sticky notes to the right.
    const origin = this.placementOrigin(snapshot);
    const objects: GeneratedFragment['objects'] = [];
    const edges: GeneratedFragment['edges'] = [];
    const palette = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa'];
    clusters.forEach((cluster, i) => {
      const colOrigin = { x: origin.x + i * 240, y: origin.y };
      const grid = layoutStickyGrid(cluster.items ?? [], { x: colOrigin.x, y: colOrigin.y + 80 }, 1, palette[i % palette.length]);
      objects.push(...grid.objects);
    });
    const fragment = { objects, edges };
    await this.appendFragment(actorId, boardId, snapshot, fragment);
    return { clusters, fragment };
  }

  /** Ensures a board's content is embedded; returns number of chunks indexed. */
  async indexBoard(boardId: string): Promise<number> {
    const { workspaceId, snapshot } = await this.snapshotOf(boardId);
    const units = boardTextUnits(snapshot).map((u) => ({
      sourceType: EmbeddingSourceType.BOARD_OBJECT,
      sourceId: `${boardId}:${u.objectId}`,
      content: u.content,
      metadata: { boardId, objectId: u.objectId },
    }));
    return this.embeddings.indexUnits(workspaceId, boardId, units);
  }

  /** RAG-grounded chat over the board. Indexes lazily if nothing is indexed yet. */
  async chat(
    boardId: string,
    message: string,
    history: ChatMessage[] = [],
  ): Promise<{ answer: string; sources: SearchHit[] }> {
    const { workspaceId } = await this.snapshotOf(boardId);
    let hits = await this.embeddings.search(workspaceId, message, { boardId, limit: 8 });
    if (hits.length === 0) {
      await this.indexBoard(boardId);
      hits = await this.embeddings.search(workspaceId, message, { boardId, limit: 8 });
    }

    const context = hits.map((h, i) => `[${i + 1}] ${h.content}`).join('\n');
    const messages: ChatMessage[] = [
      { role: 'system', content: BOARD_CHAT_SYSTEM },
      ...history.slice(-6),
      {
        role: 'user',
        content: `Board context:\n${context || '(no indexed content)'}\n\nQuestion: ${message}`,
      },
    ];
    const result = await this.ai.chat(messages);
    return { answer: result.content, sources: hits };
  }
}
