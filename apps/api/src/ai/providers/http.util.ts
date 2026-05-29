/** Small fetch helpers shared by HTTP-based AI providers. */

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export interface FetchJsonOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Combines an external AbortSignal with an internal timeout. */
function withTimeout(timeoutMs: number, external?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener('abort', () => controller.abort(external.reason), { once: true });
  }
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { signal, cancel } = withTimeout(opts.timeoutMs ?? 120_000, opts.signal);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AiProviderError(
        `Upstream returned ${res.status}: ${text.slice(0, 500)}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  } finally {
    cancel();
  }
}

/** Streams a newline-delimited-JSON (NDJSON) HTTP response line by line. */
export async function* streamNdjson(
  url: string,
  opts: FetchJsonOptions = {},
): AsyncGenerator<unknown> {
  const { signal, cancel } = withTimeout(opts.timeoutMs ?? 120_000, opts.signal);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'POST',
      headers: { 'content-type': 'application/json', ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
    });
    if (!res.ok || !res.body) {
      const text = res.body ? await res.text().catch(() => '') : '';
      throw new AiProviderError(`Upstream returned ${res.status}: ${text.slice(0, 500)}`, res.status);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) yield JSON.parse(line);
      }
    }
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail);
  } finally {
    cancel();
  }
}
