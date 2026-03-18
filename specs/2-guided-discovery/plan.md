# Implementation Plan: Guided Discovery

**Branch**: `2-guided-discovery` | **Date**: 2026-03-18 | **Spec**: `specs/2-guided-discovery/spec.md`
**Input**: Feature specification from `/specs/2-guided-discovery/spec.md`

## Summary

Add an LLM-powered conversational interface that guides users through spec discovery. The user describes their idea in a chat panel (left), and the LLM asks follow-up questions while progressively populating spec sections in the right panel. Uses the Claude API directly from the browser (no backend) with streaming responses and structured spec updates extracted from the LLM output.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) — same as Feature 1
**Primary Dependencies**: Vite (build), `@anthropic-ai/sdk` (Claude API client with streaming), existing deps from Feature 1 (marked.js, CodeMirror 6, idb)
**Storage**: IndexedDB via idb (conversations added as v2 migration), localStorage (API key only)
**Testing**: Vitest + jsdom (unit/integration)
**Target Platform**: Modern browsers (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+)
**Project Type**: Single-page web application (static site, no backend)
**Performance Goals**: < 200ms time-to-first-token display, < 2s spec panel update after LLM generates content (SB-002), < 100ms section focus response
**Constraints**: Local-first (Constitution IV), no server dependency, API key never leaves localStorage except for Claude API calls (INV-001)

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Spec-First, Always | PASS | Full spec written and reviewed. Plan follows spec. |
| II. Incremental Disclosure | PASS | Conversation starts with a simple idea and progressively discovers user stories, requirements, invariants, lifecycles. No upfront forms. |
| III. Simplicity Over Features | PASS | Uses `@anthropic-ai/sdk` (official, maintained). No additional frameworks. Vanilla DOM for chat UI. Extends existing CSS tokens. |
| IV. Local-First | PASS | Direct browser-to-API calls. No backend server. Conversations persisted in IndexedDB. API key in localStorage only. |
| V. Markdown as Truth | PASS | LLM output parsed into spec sections stored as markdown. All existing markdown-as-truth flows preserved. |
| VI. Pipeline Awareness | PASS | Conversation context includes pipeline stage. LLM suggests stage transitions when spec is sufficiently complete. |
| VII. Test-First Development | PASS | Tests written before implementation for each module. |

## Key Technical Decisions

### Claude API Integration

Use `@anthropic-ai/sdk` with `client.messages.stream()` for streaming responses. Direct browser-to-API calls — no backend proxy needed. The SDK handles SSE parsing and provides event-based token delivery.

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
const stream = client.messages.stream({
  model: 'claude-sonnet-4-5-20250514',
  max_tokens: 4096,
  system: buildSystemPrompt(specState, focusSection),
  messages: conversationHistory,
})

for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    handleToken(event.delta.text)
  }
}
```

**Why**: The official SDK is maintained, handles auth headers, SSE parsing, and error types. The `dangerouslyAllowBrowser: true` flag enables client-side usage without a proxy, which aligns with our local-first constitution.

### System Prompt Design

A carefully crafted system prompt sent with every message. Rebuilt before each request to include current state. Structure:

1. **Role**: "You are a spec discovery assistant for spec-kit..."
2. **Template structure**: Full spec-kit section definitions (user stories, invariants, lifecycles, behaviors, design language, glossary)
3. **Signal detection rules**: Patterns that trigger deep dives (lifecycle signals, invariant signals, behavior signals, design language signals)
4. **Current spec state**: The full current spec content so the LLM knows what exists
5. **Focus context**: If the user clicked a section, include "The user wants to focus on [section name]"
6. **Glossary terms**: Existing terms so the LLM reuses them rather than creating duplicates
7. **Output format instructions**: How to emit spec updates using the delimiter format

### LLM Output Format

The LLM response contains natural conversational text interleaved with structured spec update blocks. A delimiter-based format allows the response parser to extract updates while preserving the conversational flow:

```
Great question about your users! Based on what you've told me, here's what I'm thinking:

<<<SPEC_UPDATE section="User Stories" action="replace">>>
### User Story 1 - Photo Upload (Priority: P1)

A user opens the app and taps the camera icon to take or select a photo...

**Acceptance Scenarios**:

1. **Given** the user is on the home screen, **When** they tap the camera icon, **Then** the device camera or photo picker opens
<<<END_UPDATE>>>

Now, you mentioned albums — how do you envision organizing photos? By date, by event, or something else?

<<<SPEC_UPDATE section="Key Entities" action="append">>>
- **Photo**: A single image uploaded by a user. Has metadata (date, location, tags) and belongs to one or more albums.
- **Album**: A named collection of photos. Can be shared with other users.
<<<END_UPDATE>>>
```

**Why delimiters over JSON**: The LLM can produce conversational text and structured updates in a single response without needing to switch output modes. Delimiters are robust to partial streaming — the parser accumulates tokens and extracts complete blocks as they finish. JSON would require the entire response to be valid JSON, which conflicts with streaming.

### Streaming Architecture

Tokens arrive via the SDK's async iterator. The chat panel appends tokens to the current message bubble in real-time. The response parser watches for delimiter patterns:

1. Tokens accumulate in a buffer
2. When `<<<SPEC_UPDATE ...>>>` is detected, subsequent tokens go to an update buffer (hidden from chat display)
3. When `<<<END_UPDATE>>>` is detected, the update is parsed and applied to the spec
4. The spec panel re-renders the affected section card with a yellow highlight flash
5. Conversational text between updates renders normally in the chat

### Conversation Storage

Messages stored in IndexedDB in a new `conversations` object store (DB v2 migration). Each conversation is tied to a project via `projectId`. Messages include the raw content plus extracted `specUpdates` for replay/audit.

### API Key Management

- Stored in `localStorage` under key `spec-workbench-api-key` (INV-001)
- Never written to IndexedDB, never included in exports, never logged
- Input uses `type="password"` with show/hide toggle
- Validated by making a lightweight test API call before saving
- If missing or invalid on app launch, show modal overlay before rendering discovery layout

## Project Structure

### New Files

```text
src/
├── llm/
│   ├── client.ts          # Claude API client wrapper with streaming
│   ├── system-prompt.ts   # System prompt builder (template + context + signals)
│   ├── response-parser.ts # Extract spec updates from delimited blocks in stream
│   └── config.ts          # API key management (localStorage read/write/validate)
├── views/
│   ├── chat.ts            # Chat panel (message list, input, streaming display)
│   ├── api-key-modal.ts   # API key entry/update modal
│   ├── coverage-bar.ts    # Spec section coverage progress bar
│   └── discovery-layout.ts # Split layout: chat (left) + spec (right)
├── models/
│   └── conversation.ts    # Conversation, Message, SpecUpdate, LLMConfig types
```

### Modified Files

```text
src/main.ts              # New entry flow: check API key -> modal or discovery layout
src/store/db.ts          # DB v2 migration: add conversations object store
src/store/state.ts       # Add conversation state fields (messages, focus, status)
src/views/content.ts     # Section highlight on LLM update, focus indicator
src/editors/section-card.ts  # Click-to-focus behavior (emit focus event)
src/styles/components.css    # Chat bubbles, typing indicator, coverage bar, highlights
index.html               # CSP update: connect-src https://api.anthropic.com
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `@anthropic-ai/sdk` dependency | Official SDK handles SSE parsing, auth, error types, retries | Raw `fetch` with SSE parsing is error-prone and duplicates maintained code |
| `dangerouslyAllowBrowser: true` | Constitution IV (local-first) requires no backend | A proxy server would violate the local-first principle |
| Delimiter-based output format | Allows interleaved conversation + structured updates in streaming | JSON output would require complete response before parsing; function calling doesn't support streaming partial structured output alongside text |
