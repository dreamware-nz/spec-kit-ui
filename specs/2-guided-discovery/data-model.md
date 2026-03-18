# Data Model: Guided Discovery

**Branch**: `2-guided-discovery` | **Date**: 2026-03-18
**Input**: `specs/2-guided-discovery/spec.md` and `specs/2-guided-discovery/plan.md`

## Entities

### Conversation

A sequence of messages between user and LLM, associated with a project. One conversation per project (may be extended to per-feature in Phase 4).

```typescript
interface Conversation {
  id: string                       // crypto.randomUUID()
  projectId: string                // FK to Project.id
  messages: Message[]              // Ordered by timestamp
  currentFocusSection: string | null  // Section title the conversation is focused on
  pipelineStage: PipelineStage     // Current stage context (specify, clarify, plan, tasks)
  createdAt: string                // ISO 8601
  updatedAt: string                // ISO 8601
}
```

**Storage**: IndexedDB `conversations` object store, keyPath `id`, indexed by `projectId`.

**Lifecycle**: Created when a project's first message is sent. Updated on every message send/receive. Never deleted independently — removed when the parent project is deleted.

### Message

A single chat message within a conversation.

```typescript
interface Message {
  id: string                       // crypto.randomUUID()
  role: 'user' | 'assistant'      // Maps to Claude API roles
  content: string                  // Full text content (for assistant: includes conversational text, excludes spec update blocks)
  specUpdates: SpecUpdate[]        // Extracted from assistant responses; empty for user messages
  timestamp: string                // ISO 8601
}
```

**Storage**: Embedded in `Conversation.messages[]` (not a separate object store). This keeps conversation loading atomic — one IndexedDB read fetches the full conversation.

**Size concern**: A long conversation (100+ messages) could grow large. Mitigation: context window management in Phase 7 will summarize older messages, but all messages remain stored for scrollback.

### SpecUpdate

A structured update to a spec section, extracted from an LLM response by the response parser.

```typescript
interface SpecUpdate {
  section: string                  // Target section title (e.g., "User Stories", "Key Entities", "Invariants")
  content: string                  // Markdown content for the section
  action: 'replace' | 'append' | 'create'  // How to apply the update
}
```

- **replace**: Overwrites the section's existing content entirely
- **append**: Adds content to the end of the existing section
- **create**: Creates a new section if it doesn't exist (used for subsections like new user stories)

**Storage**: Embedded in `Message.specUpdates[]`. Stored for audit/replay — allows the user to see which message produced which spec changes.

### LLMConfig

Configuration for the Claude API client. Stored entirely in localStorage (INV-001).

```typescript
interface LLMConfig {
  apiKey: string                   // Claude API key (sk-ant-...)
  model: string                    // Default: 'claude-sonnet-4-5-20250514'
  temperature: number              // Default: 0.7
  maxTokens: number                // Default: 4096
}
```

**Storage**: `localStorage` only. Key: `spec-workbench-llm-config`. The `apiKey` field is the sensitive value — it MUST NOT appear in IndexedDB, exports, console logs, or network traffic except to `https://api.anthropic.com`.

**Serialization**: `JSON.stringify()` / `JSON.parse()`. On read failure (corrupt data), fall back to defaults and prompt for API key.

## IndexedDB Schema

### Version 1 (Feature 1 — existing)

```
Database: spec-workbench (v1)

Object Stores:
  projects    keyPath: id    indexes: by-updated (updatedAt), by-name (name)
  artifacts   keyPath: id    indexes: by-project (projectId), by-project-type ([projectId, type]), by-updated (updatedAt)
```

### Version 2 (Feature 2 — migration)

```
Database: spec-workbench (v2)

Object Stores:
  projects       (unchanged from v1)
  artifacts      (unchanged from v1)
  conversations  keyPath: id    indexes: by-project (projectId)

Migration (v1 -> v2):
  1. Create 'conversations' object store with keyPath 'id'
  2. Create 'by-project' index on 'conversations' store, keyPath 'projectId'
  3. No data migration needed — conversations start empty
```

The `idb` library's `upgrade` callback handles this:

```typescript
upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    // v1 stores (existing code)
    const projectStore = db.createObjectStore('projects', { keyPath: 'id' })
    projectStore.createIndex('by-updated', 'updatedAt')
    projectStore.createIndex('by-name', 'name')

    const artifactStore = db.createObjectStore('artifacts', { keyPath: 'id' })
    artifactStore.createIndex('by-project', 'projectId')
    artifactStore.createIndex('by-project-type', ['projectId', 'type'])
    artifactStore.createIndex('by-updated', 'updatedAt')
  }
  if (oldVersion < 2) {
    // v2: add conversations
    const convStore = db.createObjectStore('conversations', { keyPath: 'id' })
    convStore.createIndex('by-project', 'projectId')
  }
}
```

## Indexes & Query Patterns

| Query | Store | Index | Method |
|-------|-------|-------|--------|
| Get conversation for a project | conversations | by-project | `getFromIndex('conversations', 'by-project', projectId)` |
| Get conversation by ID | conversations | (keyPath) | `get('conversations', id)` |
| Save/update conversation | conversations | — | `put('conversations', conversation)` |
| Delete conversations for a project | conversations | by-project | `getAllFromIndex` then batch delete in transaction |

## Data Lifecycle

### Conversation Creation
1. User sends first message in a project that has no conversation
2. Create `Conversation` with `id`, `projectId`, empty `messages[]`, `pipelineStage: 'specify'`
3. Add user's `Message` to `messages[]`
4. Save to IndexedDB
5. Send to LLM, receive response, add assistant `Message` with extracted `specUpdates`
6. Save updated conversation to IndexedDB

### Conversation Update
1. On every message send/receive: update `Conversation.messages[]` and `updatedAt`
2. On section focus change: update `currentFocusSection`
3. On pipeline stage transition: update `pipelineStage`
4. Debounced save to IndexedDB (reuse existing `sync.ts` pattern — 500ms debounce)

### Conversation Deletion
1. When a project is deleted, delete its conversation(s) from IndexedDB
2. Query `by-project` index, delete all matching conversations in a transaction

### State Synchronization
- On app load: fetch conversation for current project from IndexedDB, populate in-memory state
- On project switch: save current conversation, load new project's conversation
- On message send/receive: update in-memory state immediately, debounced persist to IndexedDB

## localStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `spec-workbench-llm-config` | JSON `{ apiKey, model, temperature, maxTokens }` | LLM configuration (INV-001: API key lives here only) |

## Data Size Estimates

| Entity | Typical Size | Max Reasonable Size |
|--------|-------------|---------------------|
| Single Message | 0.5-2 KB | 8 KB (long LLM response) |
| Conversation (50 messages) | 50-100 KB | 400 KB |
| LLMConfig | < 0.5 KB | < 0.5 KB |
| Total per project (conversation) | ~100 KB | ~500 KB |

IndexedDB has no practical size limit in modern browsers (typically 50%+ of available disk). localStorage is limited to ~5-10 MB but we only store the small LLMConfig there.
