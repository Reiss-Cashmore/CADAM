# Feature: Custom LLM as a selectable model in the chat dropdown

## Context

The parametric chat edge function is hardcoded to call OpenRouter. Users want to use their own LLM (Ollama, vLLM, llama.cpp) exposed via ngrok, selectable as an option in the model dropdown alongside the existing OpenRouter models. All configuration is via environment variables at build/deploy time.

## Plan (4 files, ~35 lines changed)

### 1. `src/lib/utils.ts` — Conditionally add custom model to dropdown

Append a custom model entry to `PARAMETRIC_MODELS` when `VITE_CUSTOM_LLM_NAME` is set:

```typescript
// After the PARAMETRIC_MODELS array (line 275):
if (import.meta.env.VITE_CUSTOM_LLM_NAME) {
  PARAMETRIC_MODELS.push({
    id: 'custom',
    name: import.meta.env.VITE_CUSTOM_LLM_NAME,
    description: 'Custom locally-hosted model',
    provider: 'Custom',
    supportsTools: true,
    supportsThinking: false,
    supportsVision: false,
  });
}
```

Note: `PARAMETRIC_MODELS` needs to become `let` instead of `const`, or use a mutable pattern. Alternatively, build the array conditionally. The `ModelSelector` component is fully generic and will render this entry automatically — no component changes needed.

### 2. `supabase/functions/parametric-chat/index.ts` — Route to custom LLM when model is `'custom'`

Change the current always-on `isCustomLlm` flag to be per-request based on the selected model:

**At the top (lines 19-22)**, keep env var reads but remove the global flag:

```typescript
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const CUSTOM_LLM_URL = Deno.env.get('CUSTOM_LLM_URL') ?? '';
const CUSTOM_LLM_API_KEY = Deno.env.get('CUSTOM_LLM_API_KEY') ?? '';
const CUSTOM_LLM_MODEL = Deno.env.get('CUSTOM_LLM_MODEL') ?? '';
```

**After parsing the request body** (after line 541), derive routing per-request:

```typescript
const isCustomLlm = model === 'custom' && !!CUSTOM_LLM_URL;
const llmApiUrl = isCustomLlm ? CUSTOM_LLM_URL : OPENROUTER_API_URL;
const llmApiKey = isCustomLlm ? CUSTOM_LLM_API_KEY : OPENROUTER_API_KEY;
```

**At all 3 fetch sites** (lines ~685, ~1010, ~1255), use `llmApiUrl` and `llmApiKey` instead of the current `LLM_API_URL` and `LLM_API_KEY`. The existing `isCustomLlm` conditionals for headers, model override, and reasoning already handle the rest correctly — they just need to use the request-scoped `isCustomLlm` instead of the current global one.

### 3. `.env.local.template` — Add frontend env var

```
# Custom LLM (optional — shows in model dropdown when set)
# VITE_CUSTOM_LLM_NAME="Local Llama 3"
```

### 4. `supabase/functions/.env.template` — Add backend env vars

```
# Custom LLM (optional — used when user selects the custom model)
# CUSTOM_LLM_URL="https://your-ngrok-url.ngrok-free.app/v1/chat/completions"
# CUSTOM_LLM_API_KEY="your-api-key"
# CUSTOM_LLM_MODEL="llama3"
```

### What does NOT change

- **`ModelSelector.tsx`** — generic component, renders any entry in the models array
- **`ChatSection.tsx`** — model selection flow unchanged, `'custom'` is just another string model ID
- **`messageService.ts`** — passes model string to edge function as-is
- **`shared/types.ts`** — `Model` is already `type Model = string`
- **Response parsing** — SSE streaming format is OpenAI-compatible, same parsing works
- **Other OpenRouter models** — still work exactly as before when selected

### Env var summary

| Variable               | Location     | Purpose                                                                            |
| ---------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `VITE_CUSTOM_LLM_NAME` | `.env.local` | Display name in dropdown (e.g., "Local Llama 3"). If unset, option doesn't appear. |
| `CUSTOM_LLM_URL`       | Supabase env | Full URL to chat completions endpoint (e.g., ngrok URL).                           |
| `CUSTOM_LLM_API_KEY`   | Supabase env | API key for the custom endpoint (can be empty if none required).                   |
| `CUSTOM_LLM_MODEL`     | Supabase env | Model name sent to the custom endpoint (e.g., `llama3`).                           |

## Verification

1. **Without env vars**: No "Custom" option in dropdown, all OpenRouter models work as before
2. **With env vars set**: "Local Llama 3" (or configured name) appears in the model dropdown
3. Select a standard model (e.g., Claude Sonnet) → request goes to OpenRouter as usual
4. Select the custom model → request routes to the custom LLM URL
5. Verify streaming response works with the custom endpoint
6. Test tool calling (ask "make a cube") → verify `build_parametric_model` works
7. Verify error handling if custom LLM is unreachable
