'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import type { BoardObjectBase } from '@ai-board/shared';
import { cssFor, readStyle, rotationTransform } from '@/lib/design';

export interface BoardNodeData extends Record<string, unknown> {
  object: BoardObjectBase;
  onTextChange: (id: string, text: string) => void;
  onResize: (id: string, size: { width: number; height: number }, position: { x: number; y: number }) => void;
  editable: boolean;
  locked?: boolean;
}

const TEXT_KEYS = ['text', 'label', 'content', 'title'] as const;

function readText(obj: BoardObjectBase): string {
  for (const k of TEXT_KEYS) {
    const v = obj.data?.[k];
    if (typeof v === 'string') return v;
  }
  return '';
}

/**
 * Renders a board object as a design element — sticky note, text, shape
 * (rectangle/ellipse), frame, or diagram node — honoring its design style
 * (fill/stroke/radius/opacity/rotation/typography). Selected, unlocked nodes
 * get a resize handle; text is editable in place.
 */
function BoardNodeImpl({ id, data, selected }: NodeProps) {
  const { object, onTextChange, onResize, editable, locked } = data as BoardNodeData;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(readText(object));
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setValue(readText(object)), [object]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (value !== readText(object)) onTextChange(id, value);
  };

  const s = readStyle(object);
  const isFrame = object.type === 'frame';
  const isText = object.type === 'text';
  const showHandles = ['flowchart_node', 'mindmap_node', 'sticky_note', 'shape'].includes(object.type);

  const variant: Record<string, string> = {
    sticky_note: 'rounded-md shadow-sm',
    mindmap_node: 'rounded-full border border-indigo-300 text-center font-medium',
    flowchart_node: 'rounded-md border border-cyan-400',
    text: 'bg-transparent',
    shape: '',
    frame: 'rounded-md border border-dashed border-slate-400/60',
  };

  return (
    <div
      className="h-full w-full"
      style={{ transform: rotationTransform(object), transformOrigin: 'center center' }}
    >
      {selected && !locked && (
        <NodeResizer
          minWidth={24}
          minHeight={24}
          keepAspectRatio={s.shape === 'ellipse' && false}
          onResizeEnd={(_, p) =>
            onResize(id, { width: Math.round(p.width), height: Math.round(p.height) }, { x: Math.round(p.x), y: Math.round(p.y) })
          }
          lineClassName="!border-indigo-500"
          handleClassName="!bg-white !border-indigo-500"
        />
      )}

      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden p-2 text-sm ${
          variant[object.type] ?? 'rounded-md border border-slate-300'
        } ${selected ? 'ring-2 ring-indigo-500' : ''}`}
        style={cssFor(object)}
        onDoubleClick={() => editable && !locked && setEditing(true)}
      >
        {showHandles && (
          <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
        )}

        {isFrame ? (
          <span className="absolute left-1 top-1 text-xs text-slate-400">{value || 'Frame'}</span>
        ) : editing ? (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            className="h-full w-full resize-none bg-transparent text-center outline-none"
            style={{ textAlign: s.align ?? 'center', color: s.color }}
          />
        ) : (
          <span
            className="whitespace-pre-wrap break-words"
            style={{ textAlign: s.align ?? (isText ? 'left' : 'center'), width: '100%' }}
          >
            {value || (isText ? 'Text' : '')}
          </span>
        )}

        {showHandles && (
          <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
        )}
      </div>
    </div>
  );
}

export const BoardNode = memo(BoardNodeImpl);
