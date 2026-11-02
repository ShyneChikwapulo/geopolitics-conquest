import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmSettings } from '../src/config';
import { chatComplete, chatStream } from '../src/ai/llm';
import { BACKOFF_MS, backoffAfter, canUseAi, getAiStatus, providerLabel, recordAiFailure, recordAiSuccess, resetAiStatus } from '../src/ai/status';

const proxy: LlmSettings = { endpoint: 'https://proxy.test', apiKey: null, model: 'm', viaProxy: true };
const direct: LlmSettings = { endpoint: 'https://openrouter.test', apiKey: 'k', model: 'm', viaProxy: false };
const messages = [{ role: 'user' as const, content: 'hi' }];

const json = (content: string, provider?: string): Response =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: provider ? { 'X-AI-Provider': provider } : {} });
const failing = () => vi.fn(async () => new Response('no', { status: 502 })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

beforeEach(() => resetAiStatus());

describe('AI status and back-off', () => {
  it('backs off progressively and recovers on success', () => {
    expect(backoffAfter(0)).toBe(0);
    expect(backoffAfter(1)).toBe(0);
    expect(backoffAfter(2)).toBe(30_000);
    expect(backoffAfter(99)).toBe(BACKOFF_MS[BACKOFF_MS.length - 1]);

    recordAiFailure(1_000);
    expect(canUseAi(1_000)).toBe(true); // the first failure retries straight away
    expect(getAiStatus().degraded).toBe(false);
    recordAiFailure(2_000);
    expect(getAiStatus().degraded).toBe(true);
    expect(canUseAi(2_000)).toBe(false);
    expect(canUseAi(31_999)).toBe(false);
    expect(canUseAi(32_000)).toBe(true);
    recordAiSuccess('gemini');
    expect(getAiStatus()).toMatchObject({ degraded: false, failures: 0, provider: 'gemini' });
  });

  it('only accepts provider names it knows', () => {
    expect(providerLabel('workers-ai')).toBe('Workers AI');
    expect(providerLabel('<script>')).toBeNull();
    recordAiSuccess('<script>');
    expect(getAiStatus().provider).toBeNull();
  });

  it('keeps one stable snapshot object until something changes', () => {
    const a = getAiStatus();
    recordAiSuccess(null);
    expect(getAiStatus()).toBe(a);
  });
});

describe('the AI client through the proxy', () => {
  it('records which provider answered', async () => {
    const f = (async () => json('hello there', 'workers-ai')) as unknown as typeof fetch;
    expect(await chatComplete(proxy, { messages }, f)).toBe('hello there');
    expect(getAiStatus().provider).toBe('workers-ai');
  });

  it('stops calling the service after repeated failures, then lets a call through again', async () => {
    const f = failing();
    await expect(chatComplete(proxy, { messages }, f)).rejects.toThrow();
    await expect(chatComplete(proxy, { messages }, f)).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(2);
    await expect(chatComplete(proxy, { messages }, f)).rejects.toThrow(/resting/);
    await expect(chatStream(proxy, { messages }, () => {}, f)).rejects.toThrow(/resting/);
    expect(f).toHaveBeenCalledTimes(2); // no network call while backing off
    expect(getAiStatus().degraded).toBe(true);
  });

  it('does not count a closed game (caller abort) as an outage', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const f = (async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    await expect(chatComplete(proxy, { messages, signal: ctrl.signal }, f)).rejects.toThrow();
    expect(getAiStatus().failures).toBe(0);
  });

  it('treats an empty answer as a failure', async () => {
    const f = (async () => json('   ')) as unknown as typeof fetch;
    await chatComplete(proxy, { messages }, f);
    expect(getAiStatus().failures).toBe(1);
  });

  it('streams and records the provider', async () => {
    const enc = new TextEncoder();
    const f = (async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Brazil attacks India.' } }] })}\n\ndata: [DONE]\n\n`));
            c.close();
          },
        }),
        { status: 200, headers: { 'X-AI-Provider': 'gemini' } },
      )) as unknown as typeof fetch;
    expect(await chatStream(proxy, { messages }, () => {}, f)).toBe('Brazil attacks India.');
    expect(getAiStatus().provider).toBe('gemini');
  });

  it('never backs off for a direct development key', async () => {
    const f = failing();
    for (let i = 0; i < 5; i++) await expect(chatComplete(direct, { messages }, f)).rejects.toThrow(/502/);
    expect(f).toHaveBeenCalledTimes(5);
    expect(getAiStatus().failures).toBe(0);
  });
});
