'use client';

import { useState } from 'react';
import { getNodesBounds, getViewportForBounds, useReactFlow } from '@xyflow/react';
import { toPng } from 'html-to-image';
import type { BoardEdge, BoardObjectBase } from '@ai-board/shared';
import { downloadBlob, downloadDataUrl, objectsToSvg } from '@/lib/export';
import { Button } from './ui';

/** Export the board as PNG (rasterized canvas) or SVG/JSON (from the model). */
export function ExportMenu({
  title,
  objects,
  edges,
}: {
  title: string;
  objects: BoardObjectBase[];
  edges: BoardEdge[];
}) {
  const { getNodes } = useReactFlow();
  const [open, setOpen] = useState(false);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';

  async function exportPng() {
    const nodes = getNodes();
    if (nodes.length === 0) return;
    const bounds = getNodesBounds(nodes);
    const w = Math.min(Math.max(bounds.width + 80, 200), 4000);
    const h = Math.min(Math.max(bounds.height + 80, 200), 4000);
    const viewport = getViewportForBounds(bounds, w, h, 0.2, 2, 40);
    const el = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!el) return;
    const dataUrl = await toPng(el, {
      backgroundColor: '#ffffff',
      width: w,
      height: h,
      style: {
        width: `${w}px`,
        height: `${h}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });
    downloadDataUrl(`${slug}.png`, dataUrl);
    setOpen(false);
  }

  function exportSvg() {
    downloadBlob(`${slug}.svg`, objectsToSvg(objects, edges), 'image/svg+xml');
    setOpen(false);
  }

  function exportJson() {
    downloadBlob(`${slug}.json`, JSON.stringify({ schemaVersion: 1, objects, edges }, null, 2), 'application/json');
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
        Export ▾
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-md border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <button onClick={exportPng} className="block w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">PNG</button>
          <button onClick={exportSvg} className="block w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">SVG</button>
          <button onClick={exportJson} className="block w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">JSON</button>
        </div>
      )}
    </div>
  );
}
