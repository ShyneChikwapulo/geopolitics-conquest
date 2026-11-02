// A small Cloudflare Worker that keeps every AI key out of the browser AND keeps the game's AI features
// alive when one provider runs out of quota or has an outage.
//
// It tries providers in order until one returns real text:
//   1. openrouter  : OpenRouter (free models; a list of models is tried in order by OpenRouter itself)
//   2. workers-ai  : Cloudflare Workers AI (no key: it uses the [ai] binding in wrangler.toml)
//   3. gemini      : Google Gemini (Flash-Lite models; needs the GEMINI_KEY secret)
// A provider with no key / binding configured is skipped. The browser never chooses a provider or a model.
// If every provider fails the Worker answers 502 and the game falls back to its factual match report.
//
// Secrets (npx wrangler secret put NAME):
//   OPENROUTER_KEY    OpenRouter API key
//   GEMINI_KEY        Google AI Studio API key
// Variables (wrangler.toml [vars]):
//   ALLOWED_ORIGINS   comma-separated, e.g. https://your-app.onrender.com,http://localhost:5173
//   OPENROUTER_MODELS comma-separated model ids (default: openrouter/free). MODEL is accepted as a legacy name.
//   WORKERS_AI_MODEL  default @cf/meta/llama-3.1-8b-instruct
//   GEMINI_MODELS     comma-separated, tried in order (default: gemini-3.5-flash-lite,gemini-3.1-flash-lite)
//   PROVIDER_ORDER    default openrouter,workers-ai,gemini

const MAX_TOKENS = 220;
const MAX_MESSAGES = 3;
const MAX_CHARS = 5000;
const TOTAL_BUDGET_MS = 13000; // the browser gives up after 15 s
const MIN_ATTEMPT_MS = 1500;
const PER_PROVIDER_MS = { openrouter: 7000, 'workers-ai': 6000, gemini: 7000 };

const list = (value, fallback) =>
  String(value || fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const brief = (err) => String(err?.message ?? err).replace(/\s+/g, ' ').slice(0, 120);

async function fetchJson(url, init, ms) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function callOpenRouter(env, job, ms) {
  if (!env.OPENROUTER_KEY) throw new Error('no key configured');
  const models = list(env.OPENROUTER_MODELS || env.MODEL, 'openrouter/free');
  const data = await fetchJson(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENROUTER_KEY}`,
        'HTTP-Referer': job.origin,
        'X-Title': 'Geopolitics Conquest',
      },
      body: JSON.stringify({
        ...(models.length > 1 ? { models } : { model: models[0] }),
        messages: job.messages,
        max_tokens: job.maxTokens,
        temperature: job.temperature,
        stream: false,
      }),
    },
    ms,
  );
  return data?.choices?.[0]?.message?.content;
}

async function callWorkersAi(env, job, ms) {
  if (!env.AI) throw new Error('no AI binding configured');
  const model = env.WORKERS_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
  const run = env.AI.run(model, { messages: job.messages, max_tokens: job.maxTokens, temperature: job.temperature });
  const out = await Promise.race([
    run,
    sleep(ms).then(() => {
      throw new Error('timeout');
    }),
  ]);
  return typeof out === 'string' ? out : out?.response;
}

async function callGemini(env, job, ms) {
  if (!env.GEMINI_KEY) throw new Error('no key configured');
  const system = job.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const user = job.messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');
  const body = JSON.stringify({
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: user }] }],
    // Some Gemini models spend output tokens on hidden thinking, so leave headroom beyond the visible answer.
    generationConfig: { maxOutputTokens: job.maxTokens + 400, temperature: job.temperature },
  });
  const started = Date.now();
  let lastError = new Error('no model configured');
  for (const model of list(env.GEMINI_MODELS, 'gemini-3.5-flash-lite,gemini-3.1-flash-lite')) {
    const left = ms - (Date.now() - started);
    if (left < MIN_ATTEMPT_MS) break;
    try {
      const data = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY }, body },
        left,
      );
      const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p?.text ?? '').join('');
      if (text.trim()) return text;
      lastError = new Error(`${model}: empty reply`);
    } catch (err) {
      lastError = new Error(`${model}: ${brief(err)}`);
    }
  }
  throw lastError;
}

const PROVIDERS = { openrouter: callOpenRouter, 'workers-ai': callWorkersAi, gemini: callGemini };

/** Tries each provider in order. Exported so it can be tested without HTTP. */
export async function runChain(env, job, now = Date.now) {
  const order = list(env.PROVIDER_ORDER, 'openrouter,workers-ai,gemini').filter((name) => PROVIDERS[name]);
  const deadline = now() + TOTAL_BUDGET_MS;
  const attempts = [];
  for (const name of order) {
    const remaining = deadline - now();
    if (remaining < MIN_ATTEMPT_MS) {
      attempts.push({ provider: name, reason: 'out of time' });
      continue;
    }
    try {
      const text = String((await PROVIDERS[name](env, job, Math.min(remaining, PER_PROVIDER_MS[name]))) ?? '').trim();
      if (!text) throw new Error('empty reply');
      return { ok: true, provider: name, text, attempts };
    } catch (err) {
      attempts.push({ provider: name, reason: brief(err) });
    }
  }
  return { ok: false, attempts };
}

/** Turns a finished answer into a server-sent-events stream, so streaming clients keep their typing effect. */
function sseResponse(text, headers) {
  const enc = new TextEncoder();
  const words = text.match(/\S+\s*/g) ?? [text];
  const pieces = [];
  for (let i = 0; i < words.length; i += 2) pieces.push(words.slice(i, i + 2).join(''));
  const stream = new ReadableStream({
    async start(controller) {
      for (const piece of pieces) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`));
        await sleep(25);
      }
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { ...headers, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers': 'X-AI-Provider',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (!allowed.includes(origin)) return new Response('Origin not allowed', { status: 403, headers: cors });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad JSON', { status: 400, headers: cors });
    }
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, MAX_MESSAGES) : [];
    const size = messages.reduce((n, m) => n + String(m?.content ?? '').length, 0);
    if (messages.length === 0 || size > MAX_CHARS) return new Response('Request too large', { status: 413, headers: cors });

    const job = {
      origin,
      messages: messages.map((m) => ({ role: m.role === 'system' ? 'system' : 'user', content: String(m.content ?? '') })),
      maxTokens: Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS),
      temperature: Math.min(Math.max(Number(body.temperature) || 0.5, 0), 1),
    };

    const result = await runChain(env, job);
    if (!result.ok) {
      console.log('all AI providers failed', JSON.stringify(result.attempts));
      return Response.json({ error: { message: 'All AI providers failed', attempts: result.attempts } }, { status: 502, headers: cors });
    }
    const headers = { ...cors, 'X-AI-Provider': result.provider };
    if (body.stream === true) return sseResponse(result.text, headers);
    return Response.json(
      { provider: result.provider, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: result.text } }] },
      { status: 200, headers },
    );
  },
};
