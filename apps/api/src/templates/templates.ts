import { randomUUID } from 'node:crypto';
import {
  BoardEdge,
  BoardObjectBase,
  BoardObjectType,
  BoardSnapshot,
} from '@ai-board/shared';

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
}

interface Spec {
  info: TemplateInfo;
  build: () => BoardSnapshot;
}

function note(
  text: string,
  x: number,
  y: number,
  background: string,
  size = { width: 200, height: 120 },
): BoardObjectBase {
  return {
    id: randomUUID(),
    type: BoardObjectType.STICKY_NOTE,
    position: { x, y },
    size,
    zIndex: 0,
    data: { text },
    style: { background },
  };
}

function heading(text: string, x: number, y: number): BoardObjectBase {
  return {
    id: randomUUID(),
    type: BoardObjectType.TEXT,
    position: { x, y },
    size: { width: 240, height: 48 },
    zIndex: 1,
    data: { text },
    style: { fontWeight: 700, fontSize: 20 },
  };
}

/** A labeled column of placeholder sticky notes. */
function column(title: string, x: number, color: string, rows = 3): BoardObjectBase[] {
  const objs = [heading(title, x, 0)];
  for (let i = 0; i < rows; i++) {
    objs.push(note('', x, 80 + i * 150, color, { width: 220, height: 130 }));
  }
  return objs;
}

function snapshot(objects: BoardObjectBase[], edges: BoardEdge[] = []): BoardSnapshot {
  return { schemaVersion: 1, objects, edges };
}

/** Registry of built-in board templates. */
const TEMPLATES: Record<string, Spec> = {
  blank: {
    info: { id: 'blank', name: 'Blank', description: 'An empty canvas.' },
    build: () => snapshot([]),
  },

  brainstorming: {
    info: {
      id: 'brainstorming',
      name: 'Brainstorming',
      description: 'Diverge, then group ideas into themes.',
    },
    build: () =>
      snapshot([
        heading('Brainstorm', 0, -80),
        ...column('Ideas', 0, '#fde68a', 4),
        ...column('Group', 300, '#bbf7d0', 4),
        ...column('Decide', 600, '#bfdbfe', 4),
      ]),
  },

  retro: {
    info: {
      id: 'retro',
      name: 'Retrospective',
      description: 'What went well, what didn’t, action items.',
    },
    build: () =>
      snapshot([
        heading('Sprint Retrospective', 0, -80),
        ...column('What went well', 0, '#bbf7d0'),
        ...column('What didn’t', 300, '#fecaca'),
        ...column('Action items', 600, '#bfdbfe'),
      ]),
  },

  sprint: {
    info: {
      id: 'sprint',
      name: 'Sprint Planning',
      description: 'Backlog → To do → In progress → Done.',
    },
    build: () =>
      snapshot([
        heading('Sprint Board', 0, -80),
        ...column('Backlog', 0, '#e2e8f0', 4),
        ...column('To do', 300, '#fde68a', 4),
        ...column('In progress', 600, '#bfdbfe', 4),
        ...column('Done', 900, '#bbf7d0', 4),
      ]),
  },

  design: {
    info: {
      id: 'design',
      name: 'Design frame',
      description: 'A blank frame with a heading — start a UI/diagram design.',
    },
    build: () =>
      snapshot([
        {
          id: randomUUID(),
          type: BoardObjectType.FRAME,
          position: { x: 0, y: 0 },
          size: { width: 390, height: 600 },
          zIndex: -1,
          data: { text: 'Screen' },
          style: { fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 1, radius: 12 },
        },
        {
          id: randomUUID(),
          type: BoardObjectType.SHAPE,
          position: { x: 24, y: 24 },
          size: { width: 342, height: 64 },
          zIndex: 0,
          data: { text: 'Header' },
          style: { shape: 'rectangle', fill: '#4f46e5', color: '#ffffff', radius: 8 },
        },
      ]),
  },

  journey: {
    info: {
      id: 'journey',
      name: 'User Journey Map',
      description: 'Stages, actions, thoughts and pain points.',
    },
    build: () =>
      snapshot([
        heading('User Journey', 0, -80),
        ...column('Awareness', 0, '#ede9fe'),
        ...column('Consideration', 300, '#e0e7ff'),
        ...column('Decision', 600, '#dbeafe'),
        ...column('Retention', 900, '#cffafe'),
      ]),
  },

  roadmap: {
    info: {
      id: 'roadmap',
      name: 'Product Roadmap',
      description: 'Now / Next / Later planning.',
    },
    build: () =>
      snapshot([
        heading('Product Roadmap', 0, -80),
        ...column('Now', 0, '#bbf7d0', 4),
        ...column('Next', 300, '#fde68a', 4),
        ...column('Later', 600, '#e2e8f0', 4),
      ]),
  },

  mindmap: {
    info: { id: 'mindmap', name: 'Mind Map', description: 'A central topic with branches.' },
    build: () => {
      const root: BoardObjectBase = {
        id: randomUUID(),
        type: BoardObjectType.MINDMAP_NODE,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 90 },
        zIndex: 2,
        data: { text: 'Central Topic' },
        style: { background: '#4f46e5', color: '#ffffff' },
      };
      const objects = [root];
      const edges: BoardEdge[] = [];
      const branches = ['Branch 1', 'Branch 2', 'Branch 3', 'Branch 4'];
      branches.forEach((label, i) => {
        const angle = (2 * Math.PI * i) / branches.length - Math.PI / 2;
        const b: BoardObjectBase = {
          id: randomUUID(),
          type: BoardObjectType.MINDMAP_NODE,
          position: { x: Math.round(Math.cos(angle) * 340), y: Math.round(Math.sin(angle) * 340) },
          size: { width: 180, height: 80 },
          zIndex: 1,
          data: { text: label },
          style: { background: '#e0e7ff' },
        };
        objects.push(b);
        edges.push({ id: randomUUID(), source: root.id, target: b.id });
      });
      return snapshot(objects, edges);
    },
  },
};

export function listTemplates(): TemplateInfo[] {
  return Object.values(TEMPLATES).map((t) => t.info);
}

export function buildTemplate(id: string): BoardSnapshot | null {
  return TEMPLATES[id]?.build() ?? null;
}
