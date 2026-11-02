# LLM proxy (optional, recommended)

Anything prefixed `VITE_` is compiled into the public JavaScript bundle, so an OpenRouter key placed there can be
copied by every visitor and used up. This 50-line Cloudflare Worker (free tier, no card) holds the key instead.

```bash
cd infra/llm-proxy
npx wrangler login
npx wrangler secret put OPENROUTER_KEY          # paste the key
# edit wrangler.toml: ALLOWED_ORIGINS = "https://<your-site>.onrender.com,http://localhost:5173"
npx wrangler deploy                              # prints https://conquest-llm-proxy.<you>.workers.dev
```

Then set `VITE_LLM_PROXY_URL=https://conquest-llm-proxy.<you>.workers.dev` (and leave `VITE_OPENROUTER_KEY` empty).

## Provider fallback chain

The Worker tries providers in order until one returns real text, so a spent quota or an outage at one provider does
not switch the AI off:

| Order | Provider | Credentials | Notes |
|---|---|---|---|
| 1 | OpenRouter (free models) | secret `OPENROUTER_KEY` | `OPENROUTER_MODELS` may list several models; OpenRouter tries them in order |
| 2 | Cloudflare Workers AI | none, uses the `[ai]` binding | free daily allowance; model in `WORKERS_AI_MODEL` |
| 3 | Google Gemini (Flash-Lite) | secret `GEMINI_KEY` | models in `GEMINI_MODELS`, tried in order; free quotas are per Google project and per model |

A provider without credentials is skipped, and an empty answer counts as a failure. Change the order with
`PROVIDER_ORDER`. The answering provider is returned in the `X-AI-Provider` header, and the Commentary panel shows it.
If every provider fails the Worker returns 502 and the game falls back to its match report.

Adding the Gemini key:

```bash
cd infra/llm-proxy
npx wrangler secret put GEMINI_KEY       # the NAME is GEMINI_KEY; paste the key only at the hidden prompt
npx wrangler deploy
npx wrangler secret list                 # must show OPENROUTER_KEY and GEMINI_KEY
node --test worker.test.mjs              # offline tests of the chain
```

Free-tier data sent to Google may be used to improve its products. The game only sends game facts (countries, dice,
soldier counts), never personal data.

What it enforces: only your origin may call it; the model is forced server-side; requests are capped in size and
`max_tokens`. What it does not do: per-user rate limiting. Also create the OpenRouter key with a low credit limit.
If the proxy is down or unset, the game keeps working: commentary falls back to the factual match report and the
AI strategist simply defers to the built-in heuristic.
