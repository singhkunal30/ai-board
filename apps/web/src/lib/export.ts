import type { BoardEdge, BoardObjectBase } from '@ai-board/shared';
import { fillOf, readStyle } from './design';

const PAD = 40;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Bounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

function bounds(objects: BoardObjectBase[]): Bounds {
  if (objects.length === 0) return { minX: 0, minY: 0, width: 100, height: 100 };
  const minX = Math.min(...objects.map((o) => o.position.x)) - PAD;
  const minY = Math.min(...objects.map((o) => o.position.y)) - PAD;
  const maxX = Math.max(...objects.map((o) => o.position.x + o.size.width)) + PAD;
  const maxY = Math.max(...objects.map((o) => o.position.y + o.size.height)) + PAD;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** Renders the board to a standalone SVG string (vector export). */
export function objectsToSvg(objects: BoardObjectBase[], edges: BoardEdge[]): string {
  const b = bounds(objects);
  const byId = new Map(objects.map((o) => [o.id, o]));
  const ordered = [...objects].sort((a, b2) => a.zIndex - b2.zIndex);

  const edgeSvg = edges
    .map((e) => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) return '';
      const x1 = s.position.x + s.size.width / 2 - b.minX;
      const y1 = s.position.y + s.size.height / 2 - b.minY;
      const x2 = t.position.x + t.size.width / 2 - b.minX;
      const y2 = t.position.y + t.size.height / 2 - b.minY;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="1.5"/>`;
    })
    .join('');

  const nodeSvg = ordered
    .map((o) => {
      if (o.data?.__hidden) return '';
      const s = readStyle(o);
      const x = o.position.x - b.minX;
      const y = o.position.y - b.minY;
      const w = o.size.width;
      const h = o.size.height;
      const fill = fillOf(o) ?? 'none';
      const stroke = s.stroke ?? 'none';
      const sw = s.strokeWidth ?? 0;
      const opacity = s.opacity ?? 1;
      const rot = s.rotation ? ` transform="rotate(${s.rotation} ${x + w / 2} ${y + h / 2})"` : '';
      const text = (o.data?.text ?? o.data?.label ?? '') as string;

      let shape = '';
      if (o.type !== 'text') {
        if (s.shape === 'ellipse') {
          shape = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
        } else {
          const rx = o.type === 'mindmap_node' ? h / 2 : (s.radius ?? 0);
          shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
        }
      }

      const fontSize = s.fontSize ?? 14;
      const color = s.color ?? (o.type === 'text' ? '#0f172a' : '#111827');
      const anchor = s.align === 'left' ? 'start' : s.align === 'right' ? 'end' : 'middle';
      const tx = anchor === 'start' ? x + 8 : anchor === 'end' ? x + w - 8 : x + w / 2;
      const label = text
        ? `<text x="${tx}" y="${y + h / 2 + fontSize / 3}" font-family="Inter, system-ui, sans-serif" font-size="${fontSize}" font-weight="${s.fontWeight ?? 400}" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>`
        : '';

      return `<g${rot}>${shape}${label}</g>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="0 0 ${b.width} ${b.height}"><rect width="100%" height="100%" fill="#ffffff"/>${edgeSvg}${nodeSvg}</svg>`;
}

export function downloadBlob(filename: string, data: string, type: string): void {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
