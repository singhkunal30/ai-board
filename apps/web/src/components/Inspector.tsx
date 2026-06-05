'use client';

import type { BoardObjectBase } from '@ai-board/shared';
import { readStyle } from '@/lib/design';

type Patch = {
  data?: Record<string, unknown>;
  style?: Record<string, unknown>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="flex flex-1 items-center justify-end gap-2">{children}</div>
    </div>
  );
}

function Num({ value, onChange, w = 64 }: { value: number; onChange: (n: number) => void; w?: number }) {
  return (
    <input
      type="number"
      value={Math.round(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: w }}
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
    />
  );
}

function Color({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-700"
    />
  );
}

/** Right-hand properties panel for the selected object (Figma-style). */
export function Inspector({
  object,
  onChange,
}: {
  object: BoardObjectBase;
  onChange: (id: string, patch: Patch) => void;
}) {
  const s = readStyle(object);
  const set = (patch: Patch) => onChange(object.id, patch);
  const setStyle = (style: Record<string, unknown>) => set({ style });
  const isText = object.type === 'text';
  const isShape = object.type === 'shape';

  return (
    <aside className="absolute right-3 top-16 z-10 w-60 rounded-xl border border-slate-200 bg-white/95 p-3 text-sm shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold capitalize">{object.type.replace(/_/g, ' ')}</span>
      </div>

      <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
        <Row label="Position">
          <Num value={object.position.x} onChange={(x) => set({ position: { ...object.position, x } })} />
          <Num value={object.position.y} onChange={(y) => set({ position: { ...object.position, y } })} />
        </Row>
        <Row label="Size">
          <Num value={object.size.width} onChange={(width) => set({ size: { ...object.size, width } })} />
          <Num value={object.size.height} onChange={(height) => set({ size: { ...object.size, height } })} />
        </Row>
        <Row label="Rotation">
          <Num value={s.rotation ?? 0} onChange={(rotation) => setStyle({ rotation })} w={56} />
          <span className="text-xs text-slate-400">°</span>
        </Row>
        <Row label="Opacity">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((s.opacity ?? 1) * 100)}
            onChange={(e) => setStyle({ opacity: Number(e.target.value) / 100 })}
            className="flex-1"
          />
        </Row>
      </div>

      {!isText && (
        <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <Row label="Fill">
            <Color value={s.fill ?? s.background ?? '#93c5fd'} onChange={(fill) => setStyle({ fill })} />
          </Row>
          <Row label="Stroke">
            <Color value={s.stroke ?? '#334155'} onChange={(stroke) => setStyle({ stroke })} />
            <Num value={s.strokeWidth ?? 0} onChange={(strokeWidth) => setStyle({ strokeWidth })} w={48} />
          </Row>
          <Row label="Radius">
            <Num value={s.radius ?? 0} onChange={(radius) => setStyle({ radius })} w={56} />
          </Row>
          {isShape && (
            <Row label="Shape">
              <select
                value={s.shape ?? 'rectangle'}
                onChange={(e) => setStyle({ shape: e.target.value })}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="rectangle">Rectangle</option>
                <option value="ellipse">Ellipse</option>
              </select>
            </Row>
          )}
        </div>
      )}

      <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <Row label="Text">
          <Color value={s.color ?? (isText ? '#e5e7eb' : '#111827')} onChange={(color) => setStyle({ color })} />
        </Row>
        <Row label="Font size">
          <Num value={s.fontSize ?? 14} onChange={(fontSize) => setStyle({ fontSize })} w={56} />
        </Row>
        <Row label="Weight">
          <select
            value={s.fontWeight ?? 400}
            onChange={(e) => setStyle({ fontWeight: Number(e.target.value) })}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value={400}>Regular</option>
            <option value={500}>Medium</option>
            <option value={700}>Bold</option>
          </select>
        </Row>
        <Row label="Align">
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setStyle({ align: a })}
                className={`rounded px-2 py-1 text-xs ${
                  (s.align ?? 'left') === a ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
              </button>
            ))}
          </div>
        </Row>
      </div>
    </aside>
  );
}
