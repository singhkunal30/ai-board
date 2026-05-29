import { layoutDiagram, layoutMindMap, layoutStickyGrid } from './layout.util';
import { chunkText } from '../rag/chunker';

describe('layoutMindMap', () => {
  it('creates a root, branch and child nodes with connecting edges', () => {
    const { objects, edges } = layoutMindMap({
      root: 'Go-To-Market',
      branches: [
        { title: 'Pricing', children: ['Tiers', 'Discounts'] },
        { title: 'Channels', children: ['SEO'] },
      ],
    });
    // 1 root + 2 branches + 3 children
    expect(objects).toHaveLength(6);
    // root->branch (2) + branch->child (3)
    expect(edges).toHaveLength(5);
    expect(objects[0].data.text).toBe('Go-To-Market');
  });
});

describe('layoutDiagram', () => {
  it('layers nodes so sources precede dependents', () => {
    const { objects, edges } = layoutDiagram({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    });
    expect(objects).toHaveLength(3);
    expect(edges).toHaveLength(2);
    const byLabel = Object.fromEntries(objects.map((o) => [o.data.text, o.position.x]));
    expect(byLabel['A']).toBeLessThan(byLabel['B'] as number);
    expect(byLabel['B']).toBeLessThan(byLabel['C'] as number);
  });

  it('tolerates edges referencing unknown nodes', () => {
    const { edges } = layoutDiagram({
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ source: 'a', target: 'ghost' }],
    });
    expect(edges).toHaveLength(0);
  });
});

describe('layoutStickyGrid', () => {
  it('places notes in a grid with fixed square size', () => {
    const { objects } = layoutStickyGrid(['one', 'two', 'three'], { x: 0, y: 0 }, 2);
    expect(objects).toHaveLength(3);
    expect(objects[0].size).toEqual({ width: 180, height: 180 });
    // third item wraps to a new row
    expect(objects[2].position.y).toBeGreaterThan(objects[0].position.y);
  });
});

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('hello world')).toEqual([{ index: 0, content: 'hello world' }]);
  });

  it('splits long text into multiple overlapping chunks', () => {
    const para = 'A'.repeat(500);
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = chunkText(text, 600, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].index).toBe(0);
  });

  it('returns nothing for empty input', () => {
    expect(chunkText('   ')).toEqual([]);
  });
});
