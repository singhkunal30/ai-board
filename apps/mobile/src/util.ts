/** Compact unique id (Hermes lacks crypto.randomUUID). */
export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable color for a collaborator, derived from their id. */
export function colorFor(id: string): string {
  const palette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % palette.length;
  return palette[h];
}
