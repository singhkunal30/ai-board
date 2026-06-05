'use client';

import { useState } from 'react';
import type { BoardObjectBase } from '@ai-board/shared';

type Patch = { zIndex?: number; data?: Record<string, unknown> };

function labelOf(o: BoardObjectBase): string {
  const t = (o.data?.text ?? o.data?.label) as string | undefined;
  return (t && t.trim()) || o.type.replace(/_/g, ' ');
}

/** Figma-style layers panel: z-order, lock and visibility per object. */
export function LayersPanel({
  objects,
  selectedIds,
  onPatch,
  onRemove,
}: {
  objects: BoardObjectBase[];
  selectedIds: string[];
  onPatch: (id: string, patch: Patch) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Top of the panel = top of the stack (highest zIndex first).
  const ordered = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  const maxZ = objects.reduce((m, o) => Math.max(m, o.zIndex), 0);
  const minZ = objects.reduce((m, o) => Math.min(m, o.zIndex), 0);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 left-3 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
      >
        ☰ Layers ({objects.length})
      </button>
    );
  }

  return (
    <aside className="absolute bottom-4 left-3 top-16 z-10 flex w-60 flex-col rounded-xl border border-slate-200 bg-white/95 text-sm shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="font-semibold">Layers</span>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {ordered.length === 0 && <p className="p-3 text-slate-400">No objects yet.</p>}
        {ordered.map((o) => {
          const selected = selectedIds.includes(o.id);
          const hidden = Boolean(o.data?.__hidden);
          const locked = Boolean(o.data?.__locked);
          return (
            <div
              key={o.id}
              className={`group flex items-center gap-1 rounded px-2 py-1.5 ${
                selected ? 'bg-indigo-50 dark:bg-indigo-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex-1 truncate" title={labelOf(o)}>
                {labelOf(o)}
              </span>
              <button title="Bring to front" onClick={() => onPatch(o.id, { zIndex: maxZ + 1 })} className="px-1 text-slate-400 hover:text-slate-700">⤒</button>
              <button title="Send to back" onClick={() => onPatch(o.id, { zIndex: minZ - 1 })} className="px-1 text-slate-400 hover:text-slate-700">⤓</button>
              <button
                title={locked ? 'Unlock' : 'Lock'}
                onClick={() => onPatch(o.id, { data: { __locked: !locked } })}
                className={`px-1 ${locked ? 'text-amber-500' : 'text-slate-400 hover:text-slate-700'}`}
              >
                {locked ? '🔒' : '🔓'}
              </button>
              <button
                title={hidden ? 'Show' : 'Hide'}
                onClick={() => onPatch(o.id, { data: { __hidden: !hidden } })}
                className={`px-1 ${hidden ? 'text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
              >
                {hidden ? '🙈' : '👁'}
              </button>
              <button title="Delete" onClick={() => onRemove(o.id)} className="px-1 text-slate-400 opacity-0 hover:text-red-500 group-hover:opacity-100">✕</button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
