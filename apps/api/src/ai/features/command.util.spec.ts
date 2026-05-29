import { BoardObjectType, emptyBoardSnapshot, type BoardSnapshot } from '@ai-board/shared';
import { applyCommand, commandResponseSchema } from './command.util';

function snapshotWith(): BoardSnapshot {
  return {
    schemaVersion: 1,
    objects: [
      {
        id: 'n1',
        type: BoardObjectType.STICKY_NOTE,
        position: { x: 0, y: 0 },
        size: { width: 180, height: 180 },
        zIndex: 0,
        data: { text: 'old' },
      },
      {
        id: 'n2',
        type: BoardObjectType.STICKY_NOTE,
        position: { x: 200, y: 0 },
        size: { width: 180, height: 180 },
        zIndex: 0,
        data: { text: 'keep' },
      },
    ],
    edges: [],
  };
}

describe('applyCommand', () => {
  it('adds notes and a heading with auto-placed positions', () => {
    const parsed = commandResponseSchema.parse({
      reply: 'done',
      operations: [
        { op: 'add_note', text: 'Pricing', color: '#bbf7d0' },
        { op: 'add_text', text: 'Section' },
      ],
    });
    const { snapshot, operations } = applyCommand(snapshotWith(), parsed, { x: 500, y: 0 });
    expect(operations).toHaveLength(2);
    expect(snapshot.objects).toHaveLength(4);
    const added = operations[0];
    expect(added.kind).toBe('add');
  });

  it('updates an existing node text and color', () => {
    const parsed = commandResponseSchema.parse({
      operations: [{ op: 'update', id: 'n1', text: 'new', color: '#fecaca' }],
    });
    const { snapshot, operations } = applyCommand(snapshotWith(), parsed, { x: 0, y: 0 });
    expect((snapshot.objects.find((o) => o.id === 'n1')!.data as { text: string }).text).toBe('new');
    expect(operations[0]).toMatchObject({ kind: 'update', id: 'n1' });
  });

  it('deletes a node and connects two nodes', () => {
    const parsed = commandResponseSchema.parse({
      operations: [
        { op: 'connect', source: 'n1', target: 'n2', label: 'links' },
        { op: 'delete', id: 'n2' },
      ],
    });
    const { snapshot, operations } = applyCommand(snapshotWith(), parsed, { x: 0, y: 0 });
    // n2 deleted → the edge that referenced it is dropped too.
    expect(snapshot.objects.find((o) => o.id === 'n2')).toBeUndefined();
    expect(snapshot.edges).toHaveLength(0);
    expect(operations.some((o) => o.kind === 'delete')).toBe(true);
  });

  it('ignores operations that reference unknown ids', () => {
    const parsed = commandResponseSchema.parse({
      operations: [
        { op: 'delete', id: 'ghost' },
        { op: 'update', id: 'ghost', text: 'x' },
        { op: 'connect', source: 'ghost', target: 'n1' },
      ],
    });
    const { operations } = applyCommand(snapshotWith(), parsed, { x: 0, y: 0 });
    expect(operations).toHaveLength(0);
  });

  it('rejects malformed operations via the schema', () => {
    const res = commandResponseSchema.safeParse({ operations: [{ op: 'frobnicate' }] });
    expect(res.success).toBe(false);
  });
});
