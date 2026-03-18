# Tasks: Guided Discovery

**Branch**: `2-guided-discovery` | **Date**: 2026-03-18
**Input**: `specs/2-guided-discovery/plan.md`, `specs/2-guided-discovery/data-model.md`, `specs/2-guided-discovery/security.md`

---

## Phase 1: Setup

### T001 — Install `@anthropic-ai/sdk` dependency

**Why**: Required for Claude API integration with streaming support.

**Acceptance**:
- `@anthropic-ai/sdk` is listed in `package.json` dependencies
- `npm install` succeeds without errors
- TypeScript can import `Anthropic` from the package

**Files**: `package.json`, `package-lock.json`

---

### T002 — Create directory scaffold and type definitions

**Why**: Establish the file structure before implementation begins.

**Acceptance**:
- `src/llm/` directory exists with empty `client.ts`, `system-prompt.ts`, `response-parser.ts`, `config.ts`
- `src/models/conversation.ts` exists with `Conversation`, `Message`, `SpecUpdate`, `LLMConfig` type definitions
- All files compile with `tsc --noEmit`

**Files**: `src/llm/client.ts`, `src/llm/system-prompt.ts`, `src/llm/response-parser.ts`, `src/llm/config.ts`, `src/models/conversation.ts`

---

### T003 — Add chat and streaming styles to components.css

**Why**: CSS must exist before building UI components that use these classes.

**Acceptance**:
- `.chat-panel`, `.chat-messages`, `.chat-input-area` layout classes defined
- `.message-bubble`, `.message-bubble--user`, `.message-bubble--assistant` with appropriate alignment and colors
- `.typing-indicator` with animated dots (CSS animation)
- `.coverage-bar`, `.coverage-bar-segment` with fill animation
- `.section-card--highlight` with yellow flash keyframe (300ms)
- `.section-card--focused` with blue left border
- All styles use existing CSS custom properties from `tokens.css`

**Files**: `src/styles/components.css`

---

### T004 — Update CSP in index.html for Anthropic API

**Why**: Browser will block API calls without `connect-src` allowing `api.anthropic.com` (security.md).

**Acceptance**:
- `index.html` meta CSP tag includes `connect-src 'self' https://api.anthropic.com`
- No other CSP directives are weakened

**Files**: `index.html`

---

## Phase 2: Foundational

### T005 — LLM config management (localStorage)

**Why**: API key must be stored and retrieved before any LLM calls can be made (INV-001).

**Acceptance**:
- `src/llm/config.ts` exports `getLLMConfig()`, `saveLLMConfig(config)`, `clearLLMConfig()`, `hasApiKey()`
- Config stored in `localStorage` under key `spec-workbench-llm-config`
- `saveLLMConfig` serializes with `JSON.stringify`; `getLLMConfig` deserializes with `JSON.parse` and returns defaults on failure
- API key is NEVER logged to console (verify no `console.log` of config with key)
- Unit tests: save/load round-trip, clear removes key, corrupt data returns defaults

**Files**: `src/llm/config.ts`, `tests/llm/config.test.ts`

---

### T006 — API key entry modal

**Why**: User must provide their API key before the discovery UI can function (FR-009).

**Acceptance**:
- `src/views/api-key-modal.ts` exports `renderApiKeyModal(container, onComplete)`
- Modal overlays the app with a centered card: title, description, password input, show/hide toggle, save button
- Save button validates key by calling `validateApiKey()` (from T007) — shows error on failure, calls `onComplete` on success
- Input uses `type="password"`; toggle switches to `type="text"` and back
- Modal is accessible: focus trapped, Escape does nothing (key is required), aria-labelledby on dialog
- Friendly copy: "To get started, I'll need your Claude API key."

**Files**: `src/views/api-key-modal.ts`

---

### T007 — Claude API client with streaming

**Why**: Core integration — all LLM interactions go through this client (FR-001, FR-002, SB-001).

**Acceptance**:
- `src/llm/client.ts` exports `sendMessage(messages, systemPrompt, onToken, onComplete, onError)` and `validateApiKey(apiKey)`
- Uses `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })`
- `sendMessage` calls `client.messages.stream()` with model, max_tokens, system prompt, and messages
- `onToken(text)` callback fires for each `content_block_delta` text event
- `onComplete(fullResponse)` fires when stream ends
- `onError(error)` fires on network/API errors
- `validateApiKey` makes a minimal API call (1 token max) and returns `true`/`false`
- Unit tests: mock SDK, verify callbacks fire in correct order, verify error handling

**Files**: `src/llm/client.ts`, `tests/llm/client.test.ts`

---

### T008 — System prompt builder

**Why**: The LLM needs context about spec-kit's template structure, the current spec state, and signal detection rules to guide discovery effectively (FR-005, FR-006, INV-003).

**Acceptance**:
- `src/llm/system-prompt.ts` exports `buildSystemPrompt(specContent, focusSection, pipelineStage, glossaryTerms)`
- Prompt includes: role definition, spec-kit template section descriptions (all section types), signal detection patterns (lifecycle, invariant, behavior, design language triggers), output format instructions with delimiter examples
- Prompt includes current spec content so LLM knows what already exists
- If `focusSection` is set, prompt includes "The user wants to focus on [section]. Guide the conversation toward refining this section."
- If `glossaryTerms` is provided, prompt includes "Existing glossary terms: [terms]. Reuse these rather than creating duplicates."
- Unit tests: verify all sections present in output, verify focus context injection, verify spec content inclusion

**Files**: `src/llm/system-prompt.ts`, `tests/llm/system-prompt.test.ts`

---

### T009 — Response parser (extract spec updates from stream)

**Why**: The LLM output contains interleaved conversational text and structured spec updates that must be separated (plan.md: LLM Output Format).

**Acceptance**:
- `src/llm/response-parser.ts` exports `createResponseParser(onText, onSpecUpdate)`
- `parser.feed(token)` processes tokens one at a time (streaming-compatible)
- `parser.flush()` finalizes any remaining content
- When tokens are outside `<<<SPEC_UPDATE>>>...<<<END_UPDATE>>>` blocks, calls `onText(text)`
- When a complete spec update block is detected, calls `onSpecUpdate({ section, content, action })`
- Parses `section` and `action` attributes from the opening delimiter
- Handles partial delimiters gracefully (buffers until confirmed)
- Unit tests: simple text only, single update, multiple updates interleaved with text, partial delimiter buffering, missing end delimiter (flush as text)

**Files**: `src/llm/response-parser.ts`, `tests/llm/response-parser.test.ts`

---

### T010 — Conversation model and IndexedDB v2 migration

**Why**: Conversations must persist across browser sessions (FR-011, SC-006).

**Acceptance**:
- `src/store/db.ts` updated: DB version bumped to 2, `upgrade` callback creates `conversations` store with `by-project` index when upgrading from v1
- DB type interface updated to include `conversations` store definition
- New exports: `getConversationByProject(projectId)`, `saveConversation(conversation)`, `deleteConversationsByProject(projectId)`
- Existing v1 data is preserved during migration (no data loss)
- `deleteProject` in db.ts also deletes associated conversations
- Unit tests: v1-to-v2 migration creates store, CRUD operations work, project deletion cascades to conversations

**Files**: `src/store/db.ts`, `src/models/conversation.ts`, `tests/store/db-v2.test.ts`

---

### T011 — State management additions

**Why**: In-memory state must track conversation, focus section, and chat status for reactive UI updates.

**Acceptance**:
- `src/store/state.ts` `AppState` interface extended with: `conversation: Conversation | null`, `focusSection: string | null`, `chatStatus: 'idle' | 'awaiting-response' | 'error'`, `chatError: string | null`
- Default values: `conversation: null`, `focusSection: null`, `chatStatus: 'idle'`, `chatError: null`
- Existing state fields and behavior unchanged
- Type-checks pass with `tsc --noEmit`

**Files**: `src/store/state.ts`

---

### T012 — Conversation auto-save (sync integration)

**Why**: Conversations should persist without explicit save actions, matching existing artifact auto-save behavior.

**Acceptance**:
- `src/store/sync.ts` extended to watch for conversation changes and debounce-save to IndexedDB
- Uses same debounce pattern as artifact saves (500ms)
- On project switch, current conversation is flushed before loading new one
- Unit tests: verify debounced save triggers, verify flush on project switch

**Files**: `src/store/sync.ts`, `tests/store/sync-conversation.test.ts`

---

## Phase 3: US1 — Conversational Spec Discovery (P1 MVP)

### T013 — Discovery layout (chat left + spec right)

**Why**: The core UI structure for guided discovery — split panel with chat on left and spec on right (FR-003).

**Acceptance**:
- `src/views/discovery-layout.ts` exports `renderDiscoveryLayout(container)`
- Renders a flex container with two panels: `.chat-panel` (left, 40% width) and `.spec-panel` (right, 60% width)
- Spec panel reuses existing `renderContentPanel` for section cards and preview
- Responsive: side-by-side on desktop (>1024px), tab-switchable on tablet (768-1024px), chat-only with spec as bottom sheet on mobile (<768px)
- Both panels scroll independently

**Files**: `src/views/discovery-layout.ts`

---

### T014 — Chat panel (message list, input, send)

**Why**: Primary interaction surface for the user to converse with the LLM (FR-001).

**Acceptance**:
- `src/views/chat.ts` exports `renderChatPanel(container)`
- Renders: scrollable message list, input area (textarea + send button)
- Messages rendered as bubbles: user messages right-aligned (accent color), assistant messages left-aligned (surface color)
- Textarea auto-grows up to 6 lines
- Enter sends (Shift+Enter for newline), send button disabled while awaiting response
- Send triggers: add user message to state, call LLM client, render streaming response
- Subscribes to state changes to re-render message list
- Auto-scrolls to bottom on new messages

**Files**: `src/views/chat.ts`

---

### T015 — Streaming response rendering

**Why**: Tokens must appear in real-time for perceived responsiveness (SB-001, FR-002).

**Acceptance**:
- When LLM is streaming, a typing indicator (three animated dots) appears, then is replaced by actual content
- Tokens append to the current assistant message bubble in real-time via `textContent` updates
- Spec update blocks (between delimiters) are hidden from the chat display — only conversational text shows
- When streaming completes, the full message is finalized in state
- Performance: DOM updates batched (requestAnimationFrame) to avoid layout thrashing on rapid tokens

**Files**: `src/views/chat.ts` (extends T014)

---

### T016 — Spec update application

**Why**: LLM-generated spec content must appear in the right panel as the response streams (FR-004, SB-002).

**Acceptance**:
- When the response parser emits a `SpecUpdate`, find the matching section in the current artifact by title
- Apply the update based on action: `replace` overwrites section content, `append` adds to end, `create` adds a new section
- Update the artifact in state and mark dirty for auto-save
- Spec panel re-renders the affected section card
- Update happens within 1 second of the parser emitting the update (SB-002)
- Unit tests: replace existing section, append to section, create new section, section not found (logged warning, no crash)

**Files**: `src/llm/response-parser.ts` (integration), `src/views/discovery-layout.ts` (wiring), `tests/llm/spec-update-apply.test.ts`

---

### T017 — Section highlight on LLM update

**Why**: Visual feedback showing which section was just updated draws user attention (Design Language: Section Highlight).

**Acceptance**:
- When a spec update is applied to a section card, add `.section-card--highlight` class to the card
- Yellow flash animation plays for 300ms, then the class is removed
- If the section card is collapsed, it briefly expands to show the update, then re-collapses after 2 seconds (or stays expanded if user interacts)
- Accessible: screen reader announcement "Section [name] updated" via aria-live region

**Files**: `src/views/content.ts`, `src/editors/section-card.ts`

---

### T018 — Section click-to-focus

**Why**: Clicking a section in the spec panel should steer the conversation toward that section (FR-007, SB-003).

**Acceptance**:
- Clicking a section card header (not expanding it, but a dedicated focus button/area) sets `state.focusSection` to that section's title
- The focused section gets `.section-card--focused` class (blue left border)
- Only one section can be focused at a time — clicking another clears the previous
- The system prompt builder (T008) uses `focusSection` to inject context into the next LLM call
- Clicking the already-focused section clears the focus
- Accessible: "Now discussing [section name]" announced via aria-live

**Files**: `src/editors/section-card.ts`, `src/views/content.ts`, `src/store/state.ts`

---

### T019 — Coverage bar

**Why**: Visual progress indicator showing which spec sections have content (FR-013).

**Acceptance**:
- `src/views/coverage-bar.ts` exports `renderCoverageBar(container, artifact)`
- Horizontal bar at the top of the spec panel
- Segments represent spec sections, colored: empty (gray), draft (amber), complete (green)
- A section is "draft" if it has content but under 20 characters; "complete" if over 20 characters
- Shows percentage label: "Coverage: 45%"
- Green fill animates smoothly as sections complete
- Updates reactively when spec content changes

**Files**: `src/views/coverage-bar.ts`

---

### T020 — Empty state welcome message

**Why**: First-time experience should be inviting and guide the user to start talking (Design Language: Empty State).

**Acceptance**:
- When conversation has no messages, chat panel shows a centered welcome: "Welcome to Spec Workbench. Tell me about what you want to build."
- Styled as an assistant message bubble but larger, centered
- Input area is prominent with placeholder text: "Describe your idea..."
- Welcome message disappears after the first user message is sent

**Files**: `src/views/chat.ts` (extends T014)

---

### T021 — Error handling (API failures, retry)

**Why**: API calls can fail — the user needs clear feedback and a recovery path (Edge Cases, SB-001 failure handling).

**Acceptance**:
- On API error: red error message appears in chat with error details and a "Retry" button
- Retry resends the last user message
- On network error (offline): specific message "You appear to be offline. Check your connection and try again."
- On 401 (invalid key): "Your API key appears to be invalid. Update it in settings." with link to API key modal
- On 429 (rate limit): "Rate limit reached. Please wait a moment and try again." with auto-retry after the `retry-after` header value
- Spec panel stays on last good state during errors (INV-002)
- `state.chatStatus` set to `'error'`, `state.chatError` set to error message

**Files**: `src/llm/client.ts` (error classification), `src/views/chat.ts` (error display)

---

### T022 — Conversation persistence (load on startup)

**Why**: Reopening the app should resume where the user left off (FR-011, SC-006).

**Acceptance**:
- On app init, after loading project, fetch conversation from IndexedDB via `getConversationByProject`
- Populate `state.conversation` with loaded conversation
- Chat panel renders all existing messages
- If no conversation exists, show empty state (T020)
- On project switch, save current conversation, load new project's conversation
- Skeleton loading state shows while conversation loads from IndexedDB

**Files**: `src/main.ts`, `src/views/chat.ts`

---

## Phase 4: US2 — Feature-by-Feature Discovery (P2)

### T023 — Feature tabs UI

**Why**: Multi-feature projects need a way to switch between feature specs (FR-008, Design Language: Feature Tabs).

**Acceptance**:
- Tab bar rendered above the spec panel when project has multiple features/specs
- Each tab shows: feature name + completion percentage badge
- Clicking a tab switches the spec panel and conversation context to that feature
- Active tab visually distinct (accent bottom border)
- "+" button to start discovering a new feature

**Files**: `src/views/discovery-layout.ts`

---

### T024 — Multi-feature conversation context

**Why**: When switching features, the conversation should maintain awareness of the broader project.

**Acceptance**:
- Each feature has its own conversation (or conversation segment)
- System prompt includes a summary of other features when working on a specific one
- Switching features loads that feature's conversation history in the chat panel
- The LLM can reference other features: "In your Auth feature, you defined User — I'll reuse that here"

**Files**: `src/llm/system-prompt.ts`, `src/views/chat.ts`

---

### T025 — Shared entity/glossary detection

**Why**: Same entities and terms should be consistent across features (INV-004).

**Acceptance**:
- System prompt includes all glossary terms and key entities from all features
- When the LLM detects a reference to an existing entity, it reuses the definition rather than creating a duplicate
- If the LLM detects an inconsistency, it flags it: "In Feature 1, you defined User as [X]. Here you're describing it differently. Which is correct?"
- Glossary terms are aggregated across all feature specs

**Files**: `src/llm/system-prompt.ts`, `src/parsers/spec-parser.ts` (glossary extraction)

---

### T026 — Feature transition suggestions

**Why**: The LLM should guide users between features naturally (US2 acceptance scenario 1).

**Acceptance**:
- When the LLM detects a feature's spec is mostly complete (80%+ coverage), it suggests exploring another feature
- Suggestion appears as a conversational message: "This feature looks solid. Want to explore another aspect of the app?"
- System prompt includes the safety-net pattern for feature transitions
- User can accept (creates new feature tab) or continue refining

**Files**: `src/llm/system-prompt.ts`, `src/views/chat.ts`

---

### T027 — Cross-feature entity linking

**Why**: Entities referenced across features should be navigable (US2 acceptance scenario 2).

**Acceptance**:
- When a spec update references an entity defined in another feature, the entity name is rendered as a link
- Clicking the link switches to the feature where the entity is defined and scrolls to it
- The LLM's spec update content can include `[[Entity Name]]` wiki-link syntax that the renderer converts to cross-feature links

**Files**: `src/views/content.ts`, `src/parsers/spec-parser.ts`

---

## Phase 5: US3 — Signal-Driven Deep Dives (P3)

### T028 — Signal detection in system prompt

**Why**: The LLM should naturally surface invariants, lifecycles, behaviors, and design language from conversation (US3, FR-006).

**Acceptance**:
- System prompt includes explicit signal detection rules:
  - **Lifecycle signals**: "states", "status", "pending/active/closed", "transitions", "workflow" -> suggest mapping an entity lifecycle
  - **Invariant signals**: "must never", "always", "constraint", "total should", "cannot exceed" -> suggest creating an invariant
  - **Behavior signals**: "when X happens", "the system should", "automatically", "triggers" -> suggest defining a system behavior
  - **Design language signals**: UI descriptions, component names, interaction verbs -> suggest defining design language
- Unit tests: system prompt contains all signal categories

**Files**: `src/llm/system-prompt.ts`, `tests/llm/system-prompt.test.ts`

---

### T029 — Safety-net prompt at 80% coverage

**Why**: Ensure no important concerns are missed before considering a feature complete (SB-004).

**Acceptance**:
- When coverage bar reaches 80%, the system prompt includes a safety-net instruction
- The LLM lists uncovered concerns: "I haven't heard about [security/events/observability/error handling] — relevant for this app?"
- Safety-net fires once per feature (tracked in conversation state)
- User can dismiss: "Not relevant" or engage: "Yes, let's talk about security"

**Files**: `src/llm/system-prompt.ts`, `src/views/coverage-bar.ts` (trigger detection)

---

### T030 — Structured editor integration with LLM

**Why**: LLM-generated invariants, lifecycles, and behaviors should populate the structured editors (US3 acceptance scenarios).

**Acceptance**:
- When a spec update targets the Invariants section, the response parser extracts INV-### entries and populates the invariant editor
- When a spec update targets Entity Lifecycles, it populates the lifecycle editor (states, transitions table)
- When a spec update targets System Behaviors, it populates the behavior editor (SB-### entries)
- The structured data is editable by the user after LLM generation (existing editor behavior)
- Markdown round-trip: structured data -> markdown -> structured data preserves content

**Files**: `src/llm/response-parser.ts`, `src/editors/invariant.ts`, `src/editors/lifecycle.ts`, `src/editors/behavior.ts`

---

### T031 — Deep dive conversation flows

**Why**: When the LLM surfaces a signal, the conversation should smoothly transition into exploring that topic.

**Acceptance**:
- When the LLM asks "Want to map out the order lifecycle?", the user's "yes" triggers:
  1. Focus shifts to the Entity Lifecycles section
  2. System prompt adds lifecycle-specific context
  3. LLM guides through states, transitions, terminal states
  4. Structured editor populates as the LLM generates content
- Same flow for invariants, behaviors, and design language
- User can say "not now" to skip and continue with the current topic

**Files**: `src/llm/system-prompt.ts`, `src/views/chat.ts`

---

### T032 — Uncovered concerns listing

**Why**: Users should see what the spec is missing, not just what percentage is complete.

**Acceptance**:
- Coverage bar has a clickable "See gaps" link when coverage is < 100%
- Opens a dropdown listing empty or minimal sections by name
- Clicking a section in the list focuses the conversation on that section (reuses T018)
- The LLM can also list gaps when asked "what's missing?"

**Files**: `src/views/coverage-bar.ts`, `src/views/content.ts`

---

## Phase 6: US4 — Pipeline Progression (P4)

### T033 — Pipeline stage transitions in conversation

**Why**: The LLM should suggest moving to the next pipeline stage when the spec is ready (FR-012, US4).

**Acceptance**:
- When spec coverage reaches ~90%+ and the LLM has covered key sections, it suggests: "Your spec looks comprehensive. Ready to think about the technical plan?"
- User can agree (conversation context shifts to planning) or continue refining
- Pipeline indicator in sidebar updates to reflect the new stage
- Transition is recorded in conversation state

**Files**: `src/llm/system-prompt.ts`, `src/views/sidebar.ts`, `src/store/state.ts`

---

### T034 — Plan-stage conversation flow

**Why**: The planning stage should use the same conversational approach as spec discovery (US4).

**Acceptance**:
- When in the `plan` pipeline stage, the system prompt shifts to planning context
- LLM asks about: tech stack, architecture, data model, deployment strategy
- Spec updates target plan-stage artifacts (plan.md, data-model.md, etc.)
- The spec panel shows plan-stage section cards instead of spec section cards
- User can navigate back to the spec stage without losing plan progress

**Files**: `src/llm/system-prompt.ts`, `src/views/discovery-layout.ts`

---

### T035 — Plan artifact generation from conversation

**Why**: Plan artifacts should materialize from conversation just like spec sections.

**Acceptance**:
- LLM generates plan.md content through conversation (technical context, project structure, dependencies)
- LLM generates data-model.md through conversation (entities, indexes, migrations)
- Response parser handles plan-stage update delimiters that target different artifact types
- Generated artifacts appear in the sidebar under the Plan stage

**Files**: `src/llm/response-parser.ts`, `src/llm/system-prompt.ts`

---

### T036 — Stage progression suggestions

**Why**: The LLM should guide through the full pipeline, not just spec -> plan.

**Acceptance**:
- After plan stage is sufficiently complete, LLM suggests moving to tasks
- Task generation uses the completed spec and plan as context
- Each stage transition is conversational — the LLM explains what comes next and why
- User can skip stages or go back at any time

**Files**: `src/llm/system-prompt.ts`, `src/views/chat.ts`

---

## Phase 7: Polish

### T037 — Responsive layout (tablet/mobile)

**Why**: Discovery should work on smaller screens (Design Language: Responsive Expectations).

**Acceptance**:
- Tablet (768-1024px): tab bar to switch between chat and spec panels (only one visible at a time)
- Mobile (<768px): chat panel primary, spec accessible via bottom sheet gesture or tab
- Minimum viewport 375px renders chat-only mode
- Tab/panel switching is animated (slide transition)

**Files**: `src/views/discovery-layout.ts`, `src/styles/responsive.css`

---

### T038 — Keyboard shortcuts

**Why**: Power users need keyboard-driven workflows (Design Language: Interaction Patterns).

**Acceptance**:
- `Enter` sends message (existing from T014), `Shift+Enter` for newline
- `Escape` cancels current streaming response (stops the stream, keeps partial response)
- `Cmd/Ctrl+K` opens command palette (existing) with new commands: "Focus section...", "Clear conversation", "Change API key"
- All shortcuts have visible labels in the command palette

**Files**: `src/views/chat.ts`, `src/views/command-palette.ts`

---

### T039 — Conversation history scrollback

**Why**: Users need to review earlier parts of long conversations.

**Acceptance**:
- Chat panel supports smooth scrolling through full message history
- "Jump to bottom" button appears when scrolled up
- New messages don't auto-scroll if user is reading history (only if already at bottom)
- Scroll position preserved on re-render

**Files**: `src/views/chat.ts`

---

### T040 — Message search

**Why**: Finding specific topics in long conversations improves usability.

**Acceptance**:
- Search input at top of chat panel (toggled with Cmd/Ctrl+F when chat is focused)
- Highlights matching text in message bubbles
- Up/down arrows to navigate between matches
- Shows match count: "3 of 12 matches"
- Search closes on Escape

**Files**: `src/views/chat.ts`

---

### T041 — Accessibility

**Why**: WCAG AA compliance is a requirement (Design Language: Accessibility Requirements).

**Acceptance**:
- Chat messages region has `aria-live="polite"` for new messages
- Streaming tokens are batched into sentence-length announcements (not per-token) to avoid screen reader flooding
- Section focus changes announced: "Now discussing [section name]"
- Coverage bar has `role="progressbar"` with `aria-valuenow` and `aria-valuetext`
- All interactive elements have visible focus indicators
- Color is not the only differentiator (icons/text alongside colored indicators)
- Tab order follows logical flow: chat input -> send button -> message list -> spec sections

**Files**: `src/views/chat.ts`, `src/views/coverage-bar.ts`, `src/editors/section-card.ts`, `src/views/discovery-layout.ts`

---

### T042 — Performance (context window management)

**Why**: Long conversations will exceed the LLM's context window and degrade response quality.

**Acceptance**:
- Track approximate token count of conversation history + spec content + system prompt
- When approaching the context limit (e.g., 180k tokens for claude-sonnet-4-5-20250514), summarize older messages
- Summary replaces older messages in the LLM context but full history remains in IndexedDB for scrollback
- Summarization uses the LLM itself: "Summarize this conversation so far in 500 words"
- User is notified: "Conversation summarized to stay within context limits"

**Files**: `src/llm/client.ts`, `src/llm/system-prompt.ts`, `src/views/chat.ts`
