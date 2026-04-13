# Integrate Unsloth Studio + Adapter Pattern for Swappable LLM Backends

## Context

The custom LLM backend is switching from LM Studio to Unsloth Studio, but needs to remain easy to switch back. Each backend has different auth and thinking support. All new logic goes into a single new file; changes to existing code are minimal replacements.

## Architecture

**New file:** `supabase/functions/_shared/customLlmAdapter.ts`

- Contains ALL custom LLM logic: auth, token management, request shaping, retry
- Exports one main function: `customLlmFetch(url, init, options?)` — a drop-in `fetch` replacement
- Internally selects adapter based on `CUSTOM_LLM_PROVIDER` env var
- To remove this integration later: delete the file, revert the few import/call changes in parametric-chat

**Changes to existing code (parametric-chat/index.ts):**

- Add one import
- Replace ~4 `fetch()` calls with `customLlmFetch()` when `isCustomLlm`
- Remove the scattered `delete requestBody.reasoning` / `if (isCustomLlm)` blocks (this logic moves into the adapter)

## New file: `supabase/functions/_shared/customLlmAdapter.ts`

### Exports

```typescript
/**
 * Drop-in fetch replacement for custom LLM requests.
 * Handles auth, request body preparation, and 401 retry.
 */
export async function customLlmFetch(
  url: string,
  init: RequestInit,
  options?: { thinking?: boolean },
): Promise<Response>;

/**
 * Get a valid auth token for custom LLM requests.
 * (For cases where you need the token directly, e.g. building headers manually)
 */
export async function getCustomLlmToken(): Promise<string>;
```

### Internal structure

```
customLlmFetch(url, init, options)
  ├─ Get token via adapter.getToken()
  ├─ Modify request body via adapter.prepareBody(body, options)
  │   ├─ lmstudio: delete reasoning, return as-is
  │   └─ unsloth: delete reasoning, add enable_thinking if requested
  ├─ Set Authorization header
  ├─ fetch(url, init)
  └─ On 401: adapter.handleUnauthorized() → retry once
```

### Adapter interface (internal, not exported)

```typescript
interface LlmAdapter {
  getToken(): Promise<string>;
  handleUnauthorized(): Promise<string | null>;
  prepareBody(
    body: Record<string, unknown>,
    options?: { thinking?: boolean },
  ): Record<string, unknown>;
}
```

### LM Studio adapter

- `getToken()` → returns `CUSTOM_LLM_API_KEY`
- `handleUnauthorized()` → `null` (no retry capability)
- `prepareBody()` → deletes `reasoning`

### Unsloth adapter

- `getToken()` → returns cached JWT or calls `POST /api/auth/login`
- `handleUnauthorized()` → `POST /api/auth/refresh`, fallback to full login
- `prepareBody()` → deletes `reasoning`, sets `enable_thinking: true` if thinking
- Token cache at module level (persists across warm invocations)
- Derives auth base URL from `CUSTOM_LLM_URL` (strips `/api/inference/*`)

## Env vars

**File:** `supabase/functions/.env`

```
CUSTOM_LLM_PROVIDER="unsloth"          # "lmstudio" or "unsloth"
CUSTOM_LLM_URL="https://openhans.ngrok.app/api/inference/chat/completions"
CUSTOM_LLM_MODEL="lmstudio-community/gemma-4-31b-it"
CUSTOM_LLM_API_KEY=""                   # Used by lmstudio adapter only
CUSTOM_LLM_USERNAME="unsloth"           # Used by unsloth adapter only
CUSTOM_LLM_PASSWORD=""                  # Used by unsloth adapter only
```

## Changes to parametric-chat/index.ts (minimal)

### Add import (top of file)

```typescript
import { customLlmFetch } from '../_shared/customLlmAdapter.ts';
```

### Replace fetch calls (4 locations)

Each custom LLM `fetch()` call becomes `customLlmFetch()`. Example for main chat request:

**Before (~lines 693-727):**

```typescript
if (thinking) { requestBody.reasoning = { max_tokens: 12000 }; ... }
const headers = { ... Authorization: `Bearer ${llmApiKey}` ... };
if (isCustomLlm) { delete requestBody.reasoning; }
const response = await fetch(llmApiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) });
```

**After:**

```typescript
if (!isCustomLlm && thinking) { requestBody.reasoning = { max_tokens: 12000 }; ... }
const headers = { ... Authorization: `Bearer ${isCustomLlm ? '' : OPENROUTER_API_KEY}` ... };
const response = isCustomLlm
  ? await customLlmFetch(llmApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }, { thinking })
  : await fetch(llmApiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) });
```

### Locations to update

1. Main chat request (~line 723)
2. Code gen in `build_parametric_model` (~line 1070)
3. Code gen in `edit_at_location` (~line 1310)
4. Title generation in `generateTitleFromMessages` (~line 203)

### Remove from parametric-chat

- `CUSTOM_LLM_API_KEY` env var read (line 23) — no longer needed here
- `delete requestBody.reasoning` blocks (lines 718-721)
- `if (thinking && !isCustomLlm)` conditionals in code gen (lines 1048-1054, 1292-1295) — adapter handles this

## Files

| File                                             | Action     | Scope                                                       |
| ------------------------------------------------ | ---------- | ----------------------------------------------------------- |
| `supabase/functions/_shared/customLlmAdapter.ts` | **Create** | All custom LLM logic                                        |
| `supabase/functions/.env`                        | **Edit**   | Add 3 new env vars                                          |
| `supabase/functions/parametric-chat/index.ts`    | **Edit**   | Import + swap 4 fetch calls + remove scattered conditionals |

## Switching backends

Change one env var and restart:

```
CUSTOM_LLM_PROVIDER="lmstudio"   # or "unsloth"
```

## Removing the integration

1. Delete `supabase/functions/_shared/customLlmAdapter.ts`
2. Revert the import and 4 fetch call changes in parametric-chat
3. Remove the 3 new env vars

## Verification

1. `CUSTOM_LLM_PROVIDER=unsloth` → send message → verify JWT login + inference
2. Toggle thinking → verify `enable_thinking: true` in request body
3. Switch to `CUSTOM_LLM_PROVIDER=lmstudio` → verify static key auth
4. Test tool calls (build_parametric_model) with each provider
5. Clear cached token → verify 401 retry works
