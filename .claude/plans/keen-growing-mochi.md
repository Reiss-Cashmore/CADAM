# Fix: Edge Function Wall Clock Timeout

## Context

Slower LLM models (GLM 5.1, local Gemma/Qwen, etc.) cause the edge function to be terminated mid-request. The UI shows "Failed to generate CAD" or the response cuts off. Logs show `wall clock duration warning` → `early termination`.

## Root Cause Analysis

The `parametric-chat` edge function makes **3 sequential/parallel LLM calls** within a single HTTP request:

1. **Agent call** (streaming, ~5-120s depending on model) — decides which tool to use
2. **Code generation** (non-streaming, ~10-120s) — generates OpenSCAD code
3. **Title generation** (non-streaming, ~2-10s) — runs in parallel with #2

Total worst case: **240s+** for slow models.

### Timeout Layers

| Layer | Limit | What happens |
|-------|-------|--------------|
| **Edge Runtime wall clock** | 400s (default when `WALLCLOCK_LIMIT_SEC` not set) | Isolate killed, request drops |
| **Edge Runtime CPU time** | 2s hard limit (hardcoded in CLI binary) | Isolate killed — **this is likely the real killer** |
| **Kong read_timeout** | 150s | Kong closes the upstream connection → `Http: connection closed before message completed` |
| **Client fetch** | No timeout | Waits forever until connection drops |

### The Real Killer: Kong's 150s read_timeout

From the Kong config: `read_timeout: 150000` (150s). Even though the edge runtime allows 400s wall clock, **Kong closes the connection at 150s** if it hasn't received data. For non-streaming code gen calls that take >150s, Kong times out first.

The `wall clock duration warning` in the logs is actually benign (Supabase docs confirm it's printed when a worker is terminated for any reason, even clean shutdown). The actual failure is Kong timing out.

### CPU Time Hard Limit: 2s

The `cpuTimeSoftLimitMs = 1000` and `cpuTimeHardLimitMs = 2000` are hardcoded in the edge runtime entrypoint. However, Supabase docs say CPU time only counts actual computation, not I/O wait. Since LLM calls are mostly I/O (waiting for API response), this shouldn't be the bottleneck — but heavy streaming JSON parsing could push it over.

## Fix Strategy

### 1. Increase Kong read_timeout (Infrastructure)

Kong's 150s `read_timeout` is the primary bottleneck. For local dev, we can set it higher.

**File:** `supabase/config.toml`

The Supabase CLI doesn't expose Kong timeout config directly. But for self-hosted/local, we can modify the Kong container config after startup, or set the `[api]` section's timeout if supported.

**Alternative:** After `supabase start`, patch Kong's config:
```bash
docker exec supabase_kong_cadam sh -c "
  sed -i 's/read_timeout: 150000/read_timeout: 600000/' /home/kong/kong.yml &&
  kong reload -c /home/kong/kong.yml
"
```

### 2. Stream keepalive during code generation (Code change)

The real fix: **send periodic keepalive data during long-running code gen calls** so Kong doesn't think the connection is idle. Currently, the agent streaming phase sends data continuously (keeping Kong happy), but during the non-streaming code gen phase, nothing is sent for 60-120s and Kong times out.

**Fix:** Stream a progress indicator message to the client while waiting for code gen to complete. This keeps the connection alive through Kong.

**Implementation in `parametric-chat/index.ts`:**

Before the `Promise.allSettled([codeGen, titleGen])` call, start a keepalive interval that streams a small status update every 30s:

```typescript
// Start keepalive to prevent Kong timeout during code gen
const keepaliveInterval = setInterval(() => {
  streamMessage(controller, { ...newMessageData, content });
}, 30000);

const [codeResult, titleResult] = await Promise.allSettled([...]);

clearInterval(keepaliveInterval);
```

This sends the current message state every 30s, which:
- Keeps the Kong connection alive (data is flowing)
- Keeps the client's fetch alive (not idle)
- Doesn't change the UI (same message content, client deduplicates)

### 3. Add per-fetch timeouts (Safety net)

Add `AbortController` with generous timeouts to each LLM fetch call to prevent zombie connections:

- Agent streaming call: 300s timeout
- Code gen call: 300s timeout
- Title gen call: 60s timeout (it's a small call)

This prevents a single stalled LLM connection from holding the edge function hostage indefinitely.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/parametric-chat/index.ts` | Add keepalive streaming during code gen, add per-fetch AbortController timeouts |

## Implementation Details

### Keepalive (both `build_parametric_model` and `edit_at_location` handlers)

Insert before each `Promise.allSettled`:
```typescript
const keepalive = setInterval(() => {
  try { streamMessage(controller, { ...newMessageData, content }); } catch {}
}, 30000);
```

Insert after each `Promise.allSettled`:
```typescript
clearInterval(keepalive);
```

### Per-fetch timeouts

Wrap the 3 LLM fetch calls:

**Agent call (~line 789):**
```typescript
const agentAbort = new AbortController();
const agentTimeout = setTimeout(() => agentAbort.abort(), 300000);
const response = await fetch(llmApiUrl, { ...opts, signal: agentAbort.signal });
clearTimeout(agentTimeout);
```

**Code gen calls (~line 1139, ~1381):**
Same pattern with 300s timeout.

**Title gen (~line 267):**
Same pattern with 60s timeout.

### Kong timeout patch (optional, for local dev)

Add a post-start script or document the command:
```bash
docker exec supabase_kong_cadam sh -c \
  "sed -i 's/read_timeout: 150000/read_timeout: 600000/' /home/kong/kong.yml && kong reload -c /home/kong/kong.yml"
```

## Verification

1. Select GLM 5.1 (slow cloud model) — should complete without timeout
2. Select a slow local model — should complete without timeout
3. Check logs: no more `wall clock duration warning` → `early termination` during normal requests
4. Check logs: no more `Http: connection closed before message completed`
5. Fast models (Gemini Pro, Claude) should be unaffected
6. If a model genuinely stalls for >300s, the AbortController cleanly terminates it
