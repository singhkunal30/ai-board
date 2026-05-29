import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

const TEXT_MIME = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);

/** Supported upload MIME types. */
export function isSupported(mimeType: string, filename: string): boolean {
  return (
    TEXT_MIME.has(mimeType) ||
    mimeType === 'application/pdf' ||
    mimeType.includes('wordprocessingml') ||
    mimeType.startsWith('image/') ||
    /\.(txt|md|markdown|csv|json|pdf|docx)$/i.test(filename)
  );
}

/**
 * Extracts plain text from an uploaded document for embedding. Images return
 * empty text (handled by vision features separately); the file is still stored.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const lower = filename.toLowerCase();

  if (TEXT_MIME.has(mimeType) || /\.(txt|md|markdown|csv|json)$/i.test(lower)) {
    return buffer.toString('utf8');
  }
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    return parsed.text ?? '';
  }
  if (mimeType.includes('wordprocessingml') || lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? '';
  }
  // Images and unknown binaries have no extractable text here.
  return '';
}
