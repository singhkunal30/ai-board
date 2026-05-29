'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BoardObjectBase } from '@ai-board/shared';

export interface BoardNodeData extends Record<string, unknown> {
  object: BoardObjectBase;
  onTextChange: (id: string, text: string) => void;
  editable: boolean;
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
 * Renders a board object. Visual style is chosen by object type; text is
 * editable in place (double-click) and committed on blur.
 */
function BoardNodeImpl({ id, data, selected }: NodeProps) {
  const { object, onTextChange, editable } = data as BoardNodeData;
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

  const style = (object.style ?? {}) as { background?: string; color?: string };
  const base = 'flex h-full w-full items-center justify-center overflow-hidden p-3 text-sm shadow-sm';

  const variant: Record<string, string> = {
    sticky_note: 'rounded-md',
    mindmap_node: 'rounded-full border border-indigo-300 text-center font-medium',
    flowchart_node: 'rounded-md border border-cyan-400 bg-white dark:bg-slate-800',
    text: 'bg-transparent shadow-none',
    shape: 'rounded-md border-2 border-slate-400 bg-white/70 dark:bg-slate-800/70',
  };

  return (
    <div
      className={`${base} ${variant[object.type] ?? 'rounded-md border border-slate-300 bg-white dark:bg-slate-800'} ${
        selected ? 'ring-2 ring-indigo-500' : ''
      }`}
      style={{
        background: style.background ?? (object.type === 'sticky_note' ? '#fef08a' : undefined),
        color: style.color,
      }}
      onDoubleClick={() => editable && setEditing(true)}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
      {editing ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          className="h-full w-full resize-none bg-transparent text-center outline-none"
        />
      ) : (
        <span className="whitespace-pre-wrap break-words text-center">{value || '…'}</span>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
    </div>
  );
}

export const BoardNode = memo(BoardNodeImpl);
