/**
 * Splits text into overlapping chunks suitable for embedding. Chunks break on
 * paragraph/sentence boundaries where possible to keep semantic units intact.
 */
export interface Chunk {
  index: number;
  content: string;
}

export function chunkText(text: string, maxChars = 800, overlap = 120): Chunk[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [{ index: 0, content: normalized }];

  // Prefer splitting on blank lines, then single newlines, then sentences.
  const paragraphs = normalized.split(/\n{2,}/);
  const pieces: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) pieces.push(current.trim());
    current = '';
  };

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length <= maxChars) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }
    flush();
    if (para.length <= maxChars) {
      current = para;
      continue;
    }
    // Paragraph itself too long — split by sentence.
    const sentences = para.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      if ((current + ' ' + s).length <= maxChars) {
        current = current ? `${current} ${s}` : s;
      } else {
        flush();
        current = s.length <= maxChars ? s : s.slice(0, maxChars);
      }
    }
  }
  flush();

  // Apply overlap between consecutive chunks for retrieval continuity.
  if (overlap > 0 && pieces.length > 1) {
    for (let i = 1; i < pieces.length; i++) {
      const prevTail = pieces[i - 1].slice(-overlap);
      pieces[i] = `${prevTail} ${pieces[i]}`.slice(0, maxChars + overlap);
    }
  }

  return pieces.map((content, index) => ({ index, content }));
}
