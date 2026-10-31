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

What it enforces: only your origin may call it; the model is forced server-side; requests are capped in size and
`max_tokens`. What it does not do: per-user rate limiting. Also create the OpenRouter key with a low credit limit.
If the proxy is down or unset, the game keeps working: commentary falls back to the factual match report and the
AI strategist simply defers to the built-in heuristic.
