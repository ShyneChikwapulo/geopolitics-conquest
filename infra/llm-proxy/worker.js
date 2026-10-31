// A tiny Cloudflare Worker that keeps the OpenRouter key out of the browser.
// Free tier is enough. It only accepts calls from your site, forces the model, and caps the size of a request.
//
// Secrets / variables (wrangler secret put ... / dashboard):
//   OPENROUTER_KEY    your OpenRouter API key (secret)
//   ALLOWED_ORIGINS   comma-separated, e.g. https://your-app.onrender.com,http://localhost:5173
//   MODEL             e.g. openrouter/free

const MAX_TOKENS = 220;
const MAX_MESSAGES = 3;
const MAX_CHARS = 5000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENROUTER_KEY}`,
        'HTTP-Referer': origin,
        'X-Title': 'Geopolitics Conquest',
      },
      body: JSON.stringify({
        model: env.MODEL || 'openrouter/free', // the client cannot choose the model
        messages: messages.map((m) => ({ role: m.role === 'system' ? 'system' : 'user', content: String(m.content ?? '') })),
        max_tokens: Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS),
        temperature: Math.min(Math.max(Number(body.temperature) || 0.5, 0), 1),
        stream: body.stream === true,
      }),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  },
};
