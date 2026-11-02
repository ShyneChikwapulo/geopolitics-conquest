// Run with:  node --test infra/llm-proxy/worker.test.mjs      (Node 20 or newer, no dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { runChain } from './worker.js';

const ORIGIN = 'https://game.example';
const baseEnv = {
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
  OPENROUTER_KEY: 'or-key',
  GEMINI_KEY: 'gem-key',
  AI: { run: async () => ({ response: 'from workers ai' }) },
};
const job = { origin: ORIGIN, messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }], maxTokens: 50, temperature: 0.4 };

const ok = (json) => new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
const orReply = (content) => ok({ choices: [{ message: { content } }] });
const gemReply = (text) => ok({ candidates: [{ content: { parts: [{ text }] } }] });

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  return calls;
}
const post = (body, origin = ORIGIN) =>
  new Request('https://proxy.test/', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('uses OpenRouter first when it answers', async () => {
  const calls = mockFetch(() => orReply('hello from openrouter'));
  const r = await runChain(baseEnv, job);
  assert.equal(r.provider, 'openrouter');
  assert.equal(r.text, 'hello from openrouter');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer or-key');
});

test('falls back to Workers AI when OpenRouter is rate limited', async () => {
  mockFetch(() => new Response('{}', { status: 429 }));
  const r = await runChain(baseEnv, job);
  assert.equal(r.provider, 'workers-ai');
  assert.deepEqual(r.attempts, [{ provider: 'openrouter', reason: 'HTTP 429' }]);
});

test('treats an empty OpenRouter answer (hidden reasoning only) as a failure', async () => {
  mockFetch(() => orReply(null));
  const r = await runChain(baseEnv, job);
  assert.equal(r.provider, 'workers-ai');
  assert.equal(r.attempts[0].reason, 'empty reply');
});

test('falls through to Gemini, trying its models in order', async () => {
  const urls = [];
  mockFetch((url, init) => {
    urls.push(url);
    if (url.includes('openrouter')) return new Response('{}', { status: 402 });
    if (url.includes('gemini-3.5-flash-lite')) return new Response('{}', { status: 429 });
    assert.equal(init.headers['x-goog-api-key'], 'gem-key');
    assert.ok(!url.includes('gem-key'), 'the key must not appear in the URL');
    return gemReply('hello from gemini');
  });
  const env = { ...baseEnv, AI: { run: async () => { throw new Error('quota'); } } };
  const r = await runChain(env, job);
  assert.equal(r.provider, 'gemini');
  assert.equal(r.text, 'hello from gemini');
  assert.deepEqual(
    urls.filter((u) => u.includes('googleapis')).map((u) => u.match(/models\/([^:]+)/)[1]),
    ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  );
});

test('skips providers that are not configured', async () => {
  const calls = mockFetch(() => orReply('x'));
  const r = await runChain({ ALLOWED_ORIGINS: ORIGIN, AI: baseEnv.AI }, job);
  assert.equal(r.provider, 'workers-ai');
  assert.equal(calls.length, 0);
  assert.equal(r.attempts[0].reason, 'no key configured');
});

test('honours PROVIDER_ORDER', async () => {
  mockFetch(() => gemReply('gemini first'));
  const r = await runChain({ ...baseEnv, PROVIDER_ORDER: 'gemini,openrouter' }, job);
  assert.equal(r.provider, 'gemini');
});

test('reports every attempt when all providers fail, without leaking keys', async () => {
  mockFetch(() => new Response('{}', { status: 500 }));
  const env = { ...baseEnv, AI: { run: async () => ({ response: '   ' }) } };
  const r = await runChain(env, job);
  assert.equal(r.ok, false);
  assert.equal(r.attempts.length, 3);
  assert.ok(!JSON.stringify(r).includes('or-key') && !JSON.stringify(r).includes('gem-key'));
});

test('HTTP: JSON answer carries the provider header and an OpenAI-shaped body', async () => {
  mockFetch(() => new Response('{}', { status: 429 }));
  const res = await worker.fetch(post({ messages: [{ role: 'user', content: 'hi' }] }), baseEnv);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-AI-Provider'), 'workers-ai');
  assert.equal(res.headers.get('Access-Control-Expose-Headers'), 'X-AI-Provider');
  const json = await res.json();
  assert.equal(json.choices[0].message.content, 'from workers ai');
});

test('HTTP: streaming clients receive server-sent events that end with [DONE]', async () => {
  mockFetch(() => orReply('Brazil and India each lose 1 soldier, leaving 9 against 1.'));
  const res = await worker.fetch(post({ messages: [{ role: 'user', content: 'hi' }], stream: true }), baseEnv);
  assert.equal(res.headers.get('Content-Type'), 'text/event-stream');
  const raw = await res.text();
  assert.ok(raw.trimEnd().endsWith('data: [DONE]'));
  const text = raw
    .split('\n')
    .filter((l) => l.startsWith('data: {'))
    .map((l) => JSON.parse(l.slice(6)).choices[0].delta.content)
    .join('');
  assert.equal(text, 'Brazil and India each lose 1 soldier, leaving 9 against 1.');
});

test('HTTP: 502 when everything fails, 403 for a foreign origin, 413 for oversized input', async () => {
  mockFetch(() => new Response('{}', { status: 500 }));
  const none = { ALLOWED_ORIGINS: ORIGIN };
  assert.equal((await worker.fetch(post({ messages: [{ role: 'user', content: 'hi' }] }), none)).status, 502);
  assert.equal((await worker.fetch(post({ messages: [{ role: 'user', content: 'hi' }] }, 'https://evil.example'), baseEnv)).status, 403);
  assert.equal((await worker.fetch(post({ messages: [{ role: 'user', content: 'x'.repeat(6000) }] }), baseEnv)).status, 413);
});
