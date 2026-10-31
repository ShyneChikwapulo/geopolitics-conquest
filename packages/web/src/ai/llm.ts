import type { LlmSettings } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

type FetchLike = typeof fetch;

function headersFor(settings: LlmSettings): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://localhost';
    headers['X-Title'] = 'Geopolitics Conquest';
  }
  return headers;
}

/** Combines the caller's abort signal with a timeout. */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('LLM request timed out')), ms);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/** One-shot completion. Returns the assistant text. */
export async function chatComplete(settings: LlmSettings, opts: ChatOptions, fetchImpl: FetchLike = fetch): Promise<string> {
  const t = withTimeout(opts.signal, opts.timeoutMs ?? 12_000);
  try {
    const res = await fetchImpl(settings.endpoint, {
      method: 'POST',
      headers: headersFor(settings),
      signal: t.signal,
      body: JSON.stringify({
        model: settings.model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? 200,
        temperature: opts.temperature ?? 0.4,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`LLM request failed (${res.status})`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content ?? '').trim();
  } finally {
    t.done();
  }
}

/** Streaming completion. Calls `onText` with the text so far; resolves with the full text. */
export async function chatStream(
  settings: LlmSettings,
  opts: ChatOptions,
  onText: (textSoFar: string) => void,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const t = withTimeout(opts.signal, opts.timeoutMs ?? 15_000);
  try {
    const res = await fetchImpl(settings.endpoint, {
      method: 'POST',
      headers: headersFor(settings),
      signal: t.signal,
      body: JSON.stringify({
        model: settings.model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? 160,
        temperature: opts.temperature ?? 0.7,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`LLM request failed (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue; // skips SSE comments such as ": OPENROUTER PROCESSING"
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          done = true;
          break;
        }
        try {
          const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const piece = json.choices?.[0]?.delta?.content;
          if (piece) {
            text += piece;
            onText(text);
          }
        } catch {
          /* partial or non-JSON line: ignore */
        }
      }
    }
    return text.trim();
  } finally {
    t.done();
  }
}
