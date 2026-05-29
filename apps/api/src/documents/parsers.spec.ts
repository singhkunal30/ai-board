import { extractText, isSupported } from './parsers';

describe('document parsers', () => {
  it('recognizes supported types by mime and extension', () => {
    expect(isSupported('application/pdf', 'a.pdf')).toBe(true);
    expect(isSupported('text/plain', 'notes.txt')).toBe(true);
    expect(isSupported('application/octet-stream', 'report.docx')).toBe(true);
    expect(isSupported('image/png', 'shot.png')).toBe(true);
    expect(isSupported('application/zip', 'archive.zip')).toBe(false);
  });

  it('extracts plain text and markdown directly', async () => {
    const text = await extractText(Buffer.from('hello **world**'), 'text/markdown', 'a.md');
    expect(text).toBe('hello **world**');
  });

  it('returns empty text for images (handled by vision separately)', async () => {
    const text = await extractText(Buffer.from([0xff, 0xd8]), 'image/jpeg', 'a.jpg');
    expect(text).toBe('');
  });
});
