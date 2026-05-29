/** Client configuration sourced from public env vars (baked at build time). */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/realtime';
