import { parseJsonLoose } from './ai.service';
import { MockProvider } from './providers/mock.provider';

describe('parseJsonLoose', () => {
  it('parses clean JSON', () => {
    expect(parseJsonLoose<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in a code fence', () => {
    const text = 'Sure!\n```json\n{"a":1,"b":[2,3]}\n```\nDone.';
    expect(parseJsonLoose(text)).toEqual({ a: 1, b: [2, 3] });
  });

  it('extracts the first balanced JSON object from prose', () => {
    const text = 'Here you go: {"name":"x"} hope that helps';
    expect(parseJsonLoose(text)).toEqual({ name: 'x' });
  });

  it('throws when there is no JSON', () => {
    expect(() => parseJsonLoose('no json here')).toThrow();
  });
});

describe('MockProvider', () => {
  const provider = new MockProvider(16);

  it('echoes the last user message', async () => {
    const res = await provider.chat([{ role: 'user', content: 'hello' }]);
    expect(res.content).toContain('hello');
    expect(res.model).toBe('mock-chat');
  });

  it('produces normalized embeddings of the configured dimensionality', async () => {
    const { embeddings, dimensions } = await provider.embed(['alpha', 'beta']);
    expect(dimensions).toBe(16);
    expect(embeddings).toHaveLength(2);
    const norm = Math.sqrt(embeddings[0].reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('streams chunks ending with done', async () => {
    const chunks = [];
    for await (const c of provider.chatStream([{ role: 'user', content: 'hi there' }])) {
      chunks.push(c);
    }
    expect(chunks.at(-1)?.done).toBe(true);
  });
});
