import type { CSSProperties } from 'react';
import type { BoardObjectBase } from '@ai-board/shared';

/**
 * Design properties live in `object.style` (free-form on the shared model, so
 * no schema migration is needed). This module is the single place that knows
 * how those properties map to CSS and to inspector controls.
 */
export interface DesignStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  opacity?: number;
  rotation?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  align?: 'left' | 'center' | 'right';
  shape?: 'rectangle' | 'ellipse';
  /** legacy key still written by older objects / AI layouts */
  background?: string;
}

export function readStyle(obj: BoardObjectBase): DesignStyle {
  return (obj.style ?? {}) as DesignStyle;
}

const DEFAULT_FILL: Record<string, string> = {
  sticky_note: '#fef08a',
  shape: '#93c5fd',
  frame: 'rgba(148,163,184,0.06)',
  mindmap_node: '#e0e7ff',
  flowchart_node: '#ffffff',
};

/** Effective fill, honoring the legacy `background` key. */
export function fillOf(obj: BoardObjectBase): string | undefined {
  const s = readStyle(obj);
  if (obj.type === 'text') return undefined;
  return s.fill ?? s.background ?? DEFAULT_FILL[obj.type];
}

/** CSS for the rendered node body (applied to the inner element). */
export function cssFor(obj: BoardObjectBase): CSSProperties {
  const s = readStyle(obj);
  const css: CSSProperties = {
    opacity: s.opacity ?? 1,
    color: s.color,
  };
  if (obj.type !== 'text') {
    css.background = fillOf(obj);
    if (s.stroke) {
      css.borderColor = s.stroke;
      css.borderWidth = s.strokeWidth ?? 1;
      css.borderStyle = 'solid';
    }
  }
  if (s.shape === 'ellipse') css.borderRadius = '50%';
  else if (s.radius != null) css.borderRadius = s.radius;
  if (s.fontSize) css.fontSize = s.fontSize;
  if (s.fontWeight) css.fontWeight = s.fontWeight;
  if (s.align) css.textAlign = s.align;
  return css;
}

/** Transform applied to the node wrapper for rotation. */
export function rotationTransform(obj: BoardObjectBase): string | undefined {
  const r = readStyle(obj).rotation;
  return r ? `rotate(${r}deg)` : undefined;
}
