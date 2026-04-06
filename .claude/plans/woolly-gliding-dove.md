# Fix: "Building CAD..." Infinite Loop

## Context

The chat gets stuck showing 15+ "Building CAD..." spinners when using certain LLMs (e.g. Gemma 4 31B). The root cause is in the streaming tool call parser in `parametric-chat/index.ts` — it uses `if (toolCall.id)` to detect new tool calls, but some LLMs send `id` in **every** streaming delta, not just the first. Each delta creates a new pending entry in `content.toolCalls`, producing duplicate spinners.

A secondary issue: only a single `currentToolCall` variable is tracked, so if the model emits multiple parallel tool calls (different `index` values), only the last one gets processed.

## File to modify

`/Users/reisscashmore/Development/CADAM/supabase/functions/parametric-chat/index.ts`

## Changes

### 1. Replace single `currentToolCall` with a `Map` keyed by streaming index (lines 733-737)

Replace the single variable with `const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>()`. This deduplicates by index and supports multiple parallel tool calls.

### 2. Rewrite tool call detection block (lines 807-841)

Use `!toolCallMap.has(index)` as the sole gatekeeper for creating new pending entries instead of `if (toolCall.id)`. Only the first delta for each index creates a pending UI entry — subsequent deltas just accumulate arguments.

### 3. Process ALL accumulated tool calls on `finish_reason` (lines 843-850)

Replace `if (currentToolCall) { await handleToolCall(currentToolCall) }` with iteration over all entries in `toolCallMap`, then clear the map.

### 4. Same fix for the post-loop fallback (lines 858-861)

Same pattern — iterate `toolCallMap` instead of checking a single variable.

## Verification

1. Start local stack (`npx supabase start`, `npx supabase functions serve --no-verify-jwt`, `npm run dev`)
2. Send a parametric chat message (e.g. "A Spigot Ring") using Gemma 4 31B
3. Confirm only ONE "Building CAD..." spinner appears, not 15+
4. Confirm the CAD artifact is generated and displayed correctly
5. Test with the default OpenRouter model to ensure no regression
