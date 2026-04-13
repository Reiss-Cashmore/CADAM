# Plan: Increase Timeouts for Slow Local Models

## Context

Local custom LLM models (Qwen3, GPT-OSS 120B, Nemotron) are slower than cloud APIs and hit the default Supabase Edge Runtime wall clock timeout before they can respond. The LLM `fetch()` calls in the edge function have no explicit timeout, so the limit comes from the Supabase edge runtime itself.

## Where the Timeouts Are

1. **Supabase Edge Runtime wall clock** — default 150s for local dev. Set per-function in `supabase/config.toml` via undocumented `wall_clock_timeout` or by passing `--request-idle-timeout` to `supabase functions serve`.

2. **No fetch timeout in `parametric-chat/index.ts`** — the streaming `fetch()` to OpenRouter/custom LLM (line ~700) and the code generation `fetch()` calls (lines ~1060, ~1310) have no `AbortController` or timeout. They run until the edge runtime kills them.

3. **No client-side timeout** — `src/services/messageService.ts` calls `supabase.functions.invoke()` with no timeout. The Supabase JS client uses browser `fetch()` which has no default timeout.

## Fix

### `supabase/config.toml` — increase edge function timeout

Add `wall_clock_timeout_sec` to the parametric-chat function config:

```toml
[functions.parametric-chat]
enabled = true
verify_jwt = true
wall_clock_timeout_sec = 600
```

This gives 10 minutes for slow local models. Only affects `parametric-chat` — other functions keep the default.

If `wall_clock_timeout_sec` isn't supported in this CLI version, the alternative is the `--request-idle-timeout` flag when serving:

```bash
npx supabase functions serve --no-verify-jwt --request-idle-timeout 600 --env-file supabase/functions/.env
```

### Verification

1. Select a slow local model (Nemotron 120B)
2. Send a parametric chat message
3. Wait for full response — should not timeout at ~150s
4. Confirm fast cloud models (Gemini, Claude) still work normally
