# Feature Specification: Guided Discovery

**Feature Branch**: `2-guided-discovery`
**Created**: 2026-03-18
**Status**: Draft
**Input**: Conversational LLM-guided workflow that progressively discovers and builds a complete spec through natural dialogue

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conversational Spec Discovery (Priority: P1)

A user opens the workbench and starts a conversation: "I want to build a photo album app." The LLM responds with follow-up questions — "Who are your users? What's the core thing they do first?" — and as the user answers, the spec materializes in the right panel. Sections fill in, entities appear, user stories take shape. The user watches their idea become structured in real-time without ever touching a form.

**Why this priority**: This IS the product. Without conversational discovery, the tool is just another markdown editor.

**Independent Test**: User types a 2-sentence idea, has a 5-turn conversation, and ends up with a spec containing at least 2 user stories, 3 functional requirements, and identified key entities — all generated from the conversation, not manually entered.

**Acceptance Scenarios**:

1. **Given** the workbench is open with no project, **When** the user types "I want to build a photo album app" in the chat, **Then** the LLM responds with a contextual follow-up question and a spec draft begins to appear in the right panel
2. **Given** a conversation is underway, **When** the user answers a question about users/features, **Then** the corresponding spec section updates within 2 seconds (user stories, requirements, entities, etc.)
3. **Given** the spec panel shows a partially-filled section, **When** the user clicks on that section, **Then** the chat context shifts to focus on that section and the LLM offers to help refine it
4. **Given** 5+ turns of conversation, **When** the user asks "what's missing?", **Then** the LLM analyzes the spec for gaps and suggests the next areas to explore

---

### User Story 2 - Feature-by-Feature Discovery (Priority: P2)

A user is building a complex app with multiple features. The LLM helps them discover one feature at a time — "Let's start with the core: what's the first thing a user does?" — completing each feature's spec sections before moving to the next. The user can see all discovered features in an outline and navigate between them. Each feature is a self-contained spec that connects to the others through shared entities and glossary terms.

**Why this priority**: Real apps have multiple features. Discovery needs to work incrementally across features, not just within a single spec.

**Independent Test**: User discovers 3 features through conversation, each with its own user stories, and shared entities are recognized and linked across features.

**Acceptance Scenarios**:

1. **Given** a feature spec is mostly complete, **When** the LLM detects the conversation has covered the core scenarios, **Then** it suggests "This feature looks solid. Want to explore another aspect of the app?"
2. **Given** multiple features exist, **When** the user mentions an entity that exists in another feature, **Then** the LLM recognizes it and links to the existing definition rather than creating a duplicate
3. **Given** the user is on Feature 2, **When** they say "wait, this also affects the login flow", **Then** the LLM helps update Feature 1's spec and shows both specs side-by-side

---

### User Story 3 - Signal-Driven Deep Dives (Priority: P3)

As the conversation progresses, the LLM detects signals that warrant deeper exploration: "You mentioned users have roles — should we define the authorization model?", "This order process has several states — want to map the lifecycle?", "The payment flow suggests we need some invariants around totals." It surfaces invariants, entity lifecycles, system behaviors, and design language naturally through the conversation, not as form fields to fill.

**Why this priority**: The enriched spec sections (invariants, lifecycles, behaviors, design language) are the differentiator. They need to emerge organically from conversation, not be presented as a checklist.

**Independent Test**: During a conversation about an e-commerce app, the LLM naturally surfaces at least one invariant, one entity lifecycle, and one system behavior without the user explicitly asking for them.

**Acceptance Scenarios**:

1. **Given** the user describes "orders can be pending, paid, or shipped", **When** the LLM detects lifecycle signals, **Then** it asks "Want to map out the order lifecycle?" and on confirmation, generates a state machine in the Entity Lifecycles section
2. **Given** the user says "the total should never go negative", **When** the LLM detects an invariant, **Then** it creates an INV-### entry and asks about scope and violation handling
3. **Given** the user describes a UI, **When** the LLM detects design language signals, **Then** it asks about component vocabulary, interaction patterns, and accessibility needs
4. **Given** the spec has covered most sections, **When** the LLM performs a safety-net check, **Then** it lists uncovered concerns: "I haven't heard about [security/events/observability] — relevant for this app?"

---

### User Story 4 - Pipeline Progression (Priority: P4)

When the spec is sufficiently complete, the LLM suggests moving to the next pipeline stage: "Your spec looks comprehensive. Ready to think about the technical plan?" The user can agree, and the conversation shifts to planning — tech stack, architecture, data model. The same conversational flow applies: the LLM asks questions, the plan materializes in the right panel. Each pipeline stage is a guided conversation, not a form.

**Why this priority**: The full pipeline (specify → plan → tasks) should be conversational. But spec discovery alone is a viable MVP.

**Independent Test**: User completes a spec through conversation, transitions to planning, and gets a plan.md with tech stack and architecture decisions made through dialogue.

**Acceptance Scenarios**:

1. **Given** the spec passes completeness checks, **When** the LLM suggests progressing, **Then** the pipeline indicator updates and the conversation context shifts to planning questions
2. **Given** the user is in the plan stage, **When** they discuss tech choices, **Then** plan.md, data-model.md, and contracts/ update in the right panel

---

### Edge Cases

- What happens if the LLM API is unavailable? Show a clear error with retry, fall back to manual editing mode
- What if the user goes off-topic? The LLM gently redirects: "That's interesting, but let's capture it — does it relate to [current feature] or should we note it for later?"
- What if the user wants to skip ahead? Allow it — "Sure, let's jump to the technical plan" — but note which spec sections are incomplete
- What if the user pastes a long existing document? Parse it, populate the spec, and then the LLM reviews it: "I see you have an existing spec. Let me check what's covered and what might be missing."
- What happens when the conversation gets very long? Summarize context periodically, keep recent messages + spec state as the working context

## System Behaviors

- **SB-001**: When the user sends a message in chat, the system MUST stream the LLM response token-by-token for perceived responsiveness
  - **Trigger type**: user action side-effect
  - **Failure handling**: Show error toast, preserve message in input for retry

- **SB-002**: When the LLM generates spec content during a response, the system MUST update the corresponding spec section in the right panel within 1 second of the content being generated
  - **Trigger type**: state change
  - **Failure handling**: Queue updates and apply when response completes

- **SB-003**: When the user clicks a section in the spec panel, the system MUST inject context about that section into the next LLM prompt so the conversation focuses on refining it
  - **Trigger type**: user action side-effect
  - **Failure handling**: Continue conversation without section focus if injection fails

- **SB-004**: When a feature spec reaches 80% section coverage, the system MUST suggest exploring remaining sections via the safety-net prompt pattern
  - **Trigger type**: threshold breach
  - **Failure handling**: Skip suggestion if coverage calculation fails

- **SB-005**: When the user starts a new feature conversation, the system MUST include existing glossary terms and shared entities in the LLM context so it recognizes references
  - **Trigger type**: state change
  - **Failure handling**: Proceed without shared context; may create duplicate entities

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a chat interface for conversational interaction with an LLM
- **FR-002**: System MUST stream LLM responses token-by-token using the Claude API streaming endpoint
- **FR-003**: System MUST render a split layout: chat panel (left) and spec panel (right)
- **FR-004**: System MUST update spec sections in the right panel in real-time as the LLM generates content
- **FR-005**: System MUST include the current spec state in every LLM prompt as context
- **FR-006**: System MUST include a system prompt that understands the spec-kit template structure, all section types (user stories, invariants, lifecycles, behaviors, design language, glossary), and the signal detection patterns
- **FR-007**: System MUST support clicking a spec section to focus the conversation on that section
- **FR-008**: System MUST support multiple features/specs within a single project, with shared glossary and entity context
- **FR-009**: System MUST allow the user to configure their Claude API key, stored in browser localStorage (never transmitted except to the Claude API)
- **FR-010**: System MUST provide a fallback manual editing mode when the LLM is unavailable
- **FR-011**: System MUST preserve full conversation history per project, persisted in IndexedDB
- **FR-012**: System MUST support pipeline stage transitions triggered by LLM suggestions or user initiative
- **FR-013**: System MUST display a progress/coverage indicator showing which spec sections are populated
- **FR-014**: System MUST render the spec panel using the existing section cards, structured editors, and pipeline navigation from the workbench (Feature 1)

### Key Entities

- **Conversation**: A sequence of messages between user and LLM, associated with a project. Has messages, current focus section, and pipeline stage context.
- **Message**: A single chat message. Has role (user/assistant), content (text), timestamp, and optional structured output (spec section updates produced by the LLM).
- **Focus Context**: The current section or concern the conversation is centered on. Changes when user clicks a section or LLM transitions topics. Informs the system prompt.
- **LLM Config**: API key, model name, temperature, max tokens. Stored in localStorage. Never persisted to IndexedDB or transmitted anywhere except the Claude API.

## Invariants

- **INV-001**: The API key MUST never be stored in IndexedDB, included in exported files, or logged to console — localStorage only, and only transmitted to the configured API endpoint
  - **Scope**: All storage operations, export operations, logging
  - **Violation consequence**: Reject the operation; clear key from any non-localStorage location

- **INV-002**: The spec panel MUST always reflect the current state of the spec — no stale content after LLM updates
  - **Scope**: All LLM response handling, section updates
  - **Violation consequence**: Force re-render of spec panel from source of truth (artifact content)

- **INV-003**: Conversation context sent to the LLM MUST always include the current spec state — the LLM should never generate content that contradicts what's already in the spec
  - **Scope**: All LLM prompt construction
  - **Violation consequence**: Include full spec as fallback context if incremental context fails

- **INV-004**: Shared entities and glossary terms MUST be consistent across features — the same term must have the same definition everywhere
  - **Scope**: Multi-feature spec generation, glossary management
  - **Violation consequence**: LLM flags inconsistency and asks user to resolve

## Entity Lifecycles

### Conversation

**States**: idle, active, awaiting-response, error

**Transitions**:

| From | To | Trigger | Guard condition |
|------|----|---------|-----------------|
| idle | active | User opens project | Project exists |
| active | awaiting-response | User sends message | Message non-empty |
| awaiting-response | active | LLM response completes | Response received |
| awaiting-response | error | LLM request fails | Network/API error |
| error | active | User retries or sends new message | None |

**Terminal states**: None — conversations persist indefinitely

**Re-entry rules**: Error state always recoverable via retry

### Feature Discovery

**States**: undiscovered, exploring, draft-complete, reviewed

**Transitions**:

| From | To | Trigger | Guard condition |
|------|----|---------|-----------------|
| undiscovered | exploring | LLM or user initiates feature discussion | None |
| exploring | draft-complete | LLM detects 80%+ section coverage | Coverage check passes |
| draft-complete | reviewed | User confirms spec is ready | User explicit approval |
| reviewed | exploring | User wants to revise | None |
| draft-complete | exploring | User adds new requirements | Content changed |

**Terminal states**: None

**Re-entry rules**: Features can always be reopened for revision

## Design Language

### Component Vocabulary

- **Chat Panel**: Left side of the layout. Contains message history (scrollable), input area (textarea + send button), and typing indicator during LLM streaming. This is the primary interaction surface.
- **Spec Panel**: Right side. Uses the existing section cards, structured editors, and pipeline navigation from Feature 1. Sections highlight briefly when updated by the LLM.
- **Message Bubble**: Chat message container. User messages right-aligned (accent color), LLM messages left-aligned (surface color). LLM messages may contain spec update markers that link to the section they affected.
- **Typing Indicator**: Animated dots shown while LLM is streaming. Replaced by the actual message content as tokens arrive.
- **Section Highlight**: Brief yellow flash on a section card header when the LLM updates that section's content. Draws attention to what changed.
- **Coverage Bar**: Horizontal progress bar at the top of the spec panel showing what percentage of spec sections have content. Segments colored by state (empty/draft/complete).
- **Focus Indicator**: Blue left border on the spec section that the conversation is currently focused on. Changes when user clicks a section or LLM transitions.
- **API Key Modal**: Simple modal for entering/updating the Claude API key. Shown on first launch or when key is invalid. Single input field + save button. Key is masked after entry.
- **Feature Tabs**: Tab bar above the spec panel for switching between features in multi-feature projects. Each tab shows feature name + completion percentage.

### Interaction Patterns

- **Chat Input**: Textarea with Enter to send (Shift+Enter for newline). Auto-grows up to 6 lines. Send button disabled while awaiting response.
- **Section Focus**: Click any section card in spec panel → blue focus border appears, conversation context updates. The LLM's next response will be relevant to that section.
- **Streaming Response**: LLM response appears token-by-token. Spec panel updates appear as structured blocks within the response, then apply to the actual spec.
- **Feature Switching**: Click feature tab → chat history and spec panel switch to that feature. Shared context (glossary, entities) remains visible.
- **Manual Override**: Any section card can be expanded and edited directly (existing workbench behavior). Changes are reflected in the LLM's context for the next message.

### Responsive Expectations

- **Desktop (>1024px)**: Side-by-side chat + spec panels, both visible
- **Tablet (768-1024px)**: Swipeable/tab-switchable between chat and spec panels
- **Mobile (<768px)**: Chat panel primary, spec panel accessible via bottom sheet or tab
- **Minimum viewport**: 375px (chat-only mode)

### Accessibility Requirements

- WCAG AA compliance
- Chat messages are announced to screen readers via aria-live region
- Streaming tokens are batched into sentence-length announcements (not per-token)
- Section focus changes are announced: "Now discussing [section name]"
- API key input uses type="password" with show/hide toggle
- All keyboard shortcuts have visible labels in the command palette

### State Presentation

- **Loading**: Skeleton chat bubbles while conversation history loads from IndexedDB
- **Empty State**: "Welcome to Spec Workbench. Tell me about what you want to build." — single centered message from the LLM with a large input below
- **Streaming**: Typing indicator (three animated dots) replaced by actual content as it arrives
- **Error**: Red error message in chat with "Retry" button. Spec panel stays on last good state.
- **Section Updated**: Brief yellow highlight (300ms) on section card header, then fade back to normal
- **Coverage Progress**: Green fill animation as sections complete
- **API Key Missing**: Modal overlay blocks interaction until key is provided. Friendly message: "To get started, I'll need your Claude API key."

## Glossary Additions

| Term | Definition | Avoid (synonyms) |
|------|-----------|-------------------|
| Discovery | The conversational process of exploring an idea and turning it into structured spec sections | Brainstorming, ideation session |
| Focus Context | The current spec section the conversation is centered on, influencing the LLM's system prompt | Active section, selected section |
| Coverage | Percentage of spec sections that have non-empty content, used to drive safety-net suggestions | Completeness, progress |
| Safety-Net Prompt | LLM suggestion to explore uncovered spec concerns, triggered at 80% coverage | Gap check, completeness check |
| Feature Tab | UI element for switching between feature specs in multi-feature projects | Feature selector, spec tab |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from a 2-sentence idea to a spec with 3+ user stories, requirements, and entities in under 10 minutes of conversation
- **SC-002**: The LLM naturally surfaces at least one invariant, one lifecycle, and one system behavior during a typical 15-minute discovery session for a moderately complex app
- **SC-003**: Spec sections update in the right panel within 2 seconds of the LLM generating relevant content
- **SC-004**: The conversational flow requires no training — a first-time user understands how to proceed based on the LLM's guidance alone
- **SC-005**: The system works with the Claude API (claude-sonnet-4-5-20250514 or later) with streaming support
- **SC-006**: Conversation history persists across browser sessions — reopening the app resumes where the user left off
- **SC-007**: API key is never visible in IndexedDB, exported files, network logs (except Claude API calls), or console output
