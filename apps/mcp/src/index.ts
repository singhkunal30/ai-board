#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AiBoardClient, genId, objectText, type BoardObject } from './client.js';

const client = new AiBoardClient();

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] });
const json = (v: unknown): ToolResult => text(JSON.stringify(v, null, 2));

/** Wrap a tool body so API errors become readable MCP error results. */
async function guard(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }], isError: true };
  }
}

const server = new McpServer({ name: 'ai-board', version: '0.1.0' });

server.registerTool(
  'list_workspaces',
  { description: 'List the workspaces the authenticated user can access.' },
  () => guard(async () => json(await client.listWorkspaces())),
);

server.registerTool(
  'list_boards',
  {
    description: 'List boards in a workspace.',
    inputSchema: { workspaceId: z.string().describe('Workspace id') },
  },
  ({ workspaceId }) => guard(async () => json(await client.listBoards(workspaceId))),
);

server.registerTool(
  'create_board',
  {
    description: 'Create a new board, optionally from a template (e.g. brainstorming, retro, sprint, mindmap).',
    inputSchema: {
      workspaceId: z.string(),
      title: z.string(),
      templateId: z.string().optional(),
    },
  },
  ({ workspaceId, title, templateId }) =>
    guard(async () => json(await client.createBoard(workspaceId, title, templateId))),
);

server.registerTool(
  'get_board',
  {
    description: 'Get a board with a readable summary of its items (id, type, text) and edges.',
    inputSchema: { boardId: z.string() },
  },
  ({ boardId }) =>
    guard(async () => {
      const board = await client.getBoard(boardId);
      const items = board.snapshot.objects.map((o) => ({
        id: o.id,
        type: o.type,
        text: objectText(o),
      }));
      return json({ id: board.id, title: board.title, items, edges: board.snapshot.edges });
    }),
);

server.registerTool(
  'board_command',
  {
    description:
      'Edit a board with a natural-language instruction (the AI command agent). ' +
      'Examples: "add three notes about pricing", "connect Login to Database", "delete empty notes".',
    inputSchema: { boardId: z.string(), instruction: z.string() },
  },
  ({ boardId, instruction }) =>
    guard(async () => {
      const res = await client.command(boardId, instruction);
      return json({ reply: res.reply, operationCount: res.operations.length });
    }),
);

server.registerTool(
  'generate_mindmap',
  {
    description: 'Generate a mind map from a prompt and add it to the board.',
    inputSchema: { boardId: z.string(), prompt: z.string() },
  },
  ({ boardId, prompt }) =>
    guard(async () => {
      const frag = await client.generate(boardId, 'mindmap', prompt);
      return text(`Added a mind map (${frag.objects.length} nodes) to the board.`);
    }),
);

server.registerTool(
  'generate_diagram',
  {
    description: 'Generate an architecture/flow diagram from a prompt and add it to the board.',
    inputSchema: { boardId: z.string(), prompt: z.string() },
  },
  ({ boardId, prompt }) =>
    guard(async () => {
      const frag = await client.generate(boardId, 'diagram', prompt);
      return text(`Added a diagram (${frag.objects.length} nodes) to the board.`);
    }),
);

server.registerTool(
  'generate_design',
  {
    description: 'Generate a UI/screen design (frames, shapes, text) from a prompt and add it to the board.',
    inputSchema: { boardId: z.string(), prompt: z.string() },
  },
  ({ boardId, prompt }) =>
    guard(async () => {
      const frag = await client.generate(boardId, 'design', prompt);
      return text(`Added a design (${frag.objects.length} elements) to the board.`);
    }),
);

server.registerTool(
  'summarize_board',
  { description: 'Summarize a board: overview, themes, gaps/risks, next steps.', inputSchema: { boardId: z.string() } },
  ({ boardId }) => guard(async () => text((await client.summarize(boardId)).summary)),
);

server.registerTool(
  'ask_board',
  {
    description: 'Ask a question about a board; answered with RAG over the board and its documents.',
    inputSchema: { boardId: z.string(), question: z.string() },
  },
  ({ boardId, question }) => guard(async () => text((await client.ask(boardId, question)).answer)),
);

server.registerTool(
  'add_notes',
  {
    description: 'Add sticky notes with the given texts to a board (deterministic, no AI).',
    inputSchema: { boardId: z.string(), texts: z.array(z.string()).min(1).max(50) },
  },
  ({ boardId, texts }) =>
    guard(async () => {
      const board = await client.getBoard(boardId);
      const start = board.snapshot.objects.length;
      const notes: BoardObject[] = texts.map((t, i) => ({
        id: genId(),
        type: 'sticky_note',
        position: { x: ((start + i) % 5) * 210, y: Math.floor((start + i) / 5) * 210 },
        size: { width: 180, height: 180 },
        zIndex: 0,
        data: { text: t },
        style: { background: '#fef08a' },
      }));
      const snapshot = { ...board.snapshot, objects: [...board.snapshot.objects, ...notes] };
      await client.saveSnapshot(boardId, snapshot);
      return text(`Added ${notes.length} note(s) to "${board.title}".`);
    }),
);

server.registerTool(
  'analyze_image',
  {
    description: 'Analyze a base64-encoded image with a vision model and add the analysis to the board.',
    inputSchema: { boardId: z.string(), imageBase64: z.string(), prompt: z.string().optional() },
  },
  ({ boardId, imageBase64, prompt }) =>
    guard(async () => text((await client.vision(boardId, imageBase64, prompt)).analysis)),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs MUST go to stderr — stdout is the MCP protocol channel.
  console.error('ai-board MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
