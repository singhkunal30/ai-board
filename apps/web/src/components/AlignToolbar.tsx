'use client';

import type { BoardObjectBase } from '@ai-board/shared';

type Patch = { position: { x: number; y: number } };

/**
 * Alignment & distribution for a multi-selection, computed against the
 * selection's bounding box (Figma behavior).
 */
export function AlignToolbar({
  objects,
  onPatch,
}: {
  objects: BoardObjectBase[];
  onPatch: (id: string, patch: Patch) => void;
}) {
  const left = Math.min(...objects.map((o) => o.position.x));
  const right = Math.max(...objects.map((o) => o.position.x + o.size.width));
  const top = Math.min(...objects.map((o) => o.position.y));
  const bottom = Math.max(...objects.map((o) => o.position.y + o.size.height));
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;

  const move = (o: BoardObjectBase, x: number, y: number) => onPatch(o.id, { position: { x: Math.round(x), y: Math.round(y) } });

  const alignLeft = () => objects.forEach((o) => move(o, left, o.position.y));
  const alignRight = () => objects.forEach((o) => move(o, right - o.size.width, o.position.y));
  const alignCenterX = () => objects.forEach((o) => move(o, cx - o.size.width / 2, o.position.y));
  const alignTop = () => objects.forEach((o) => move(o, o.position.x, top));
  const alignBottom = () => objects.forEach((o) => move(o, o.position.x, bottom - o.size.height));
  const alignCenterY = () => objects.forEach((o) => move(o, o.position.x, cy - o.size.height / 2));

  const distributeH = () => {
    const sorted = [...objects].sort((a, b) => a.position.x - b.position.x);
    const totalW = sorted.reduce((s, o) => s + o.size.width, 0);
    const gap = (right - left - totalW) / (sorted.length - 1);
    let x = left;
    sorted.forEach((o) => {
      move(o, x, o.position.y);
      x += o.size.width + gap;
    });
  };
  const distributeV = () => {
    const sorted = [...objects].sort((a, b) => a.position.y - b.position.y);
    const totalH = sorted.reduce((s, o) => s + o.size.height, 0);
    const gap = (bottom - top - totalH) / (sorted.length - 1);
    let y = top;
    sorted.forEach((o) => {
      move(o, o.position.x, y);
      y += o.size.height + gap;
    });
  };

  const Btn = ({ on, title, children }: { on: () => void; title: string; children: React.ReactNode }) => (
    <button onClick={on} title={title} className="rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
      {children}
    </button>
  );

  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-0.5 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <Btn on={alignLeft} title="Align left">⇤</Btn>
      <Btn on={alignCenterX} title="Align center">↔</Btn>
      <Btn on={alignRight} title="Align right">⇥</Btn>
      <span className="mx-1 w-px bg-slate-200 dark:bg-slate-700" />
      <Btn on={alignTop} title="Align top">⤒</Btn>
      <Btn on={alignCenterY} title="Align middle">↕</Btn>
      <Btn on={alignBottom} title="Align bottom">⤓</Btn>
      {objects.length >= 3 && (
        <>
          <span className="mx-1 w-px bg-slate-200 dark:bg-slate-700" />
          <Btn on={distributeH} title="Distribute horizontally">⇿</Btn>
          <Btn on={distributeV} title="Distribute vertically">⥮</Btn>
        </>
      )}
    </div>
  );
}
