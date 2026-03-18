# Data Model: Spec Workbench

**Branch**: `1-spec-workbench` | **Date**: 2026-03-18
**Storage**: IndexedDB via `idb` library

## Entities

### Project

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | Yes | Unique identifier, generated via `crypto.randomUUID()` |
| name | string | Yes | User-provided project name |
| createdAt | number (epoch ms) | Yes | Timestamp of project creation |
| updatedAt | number (epoch ms) | Yes | Timestamp of last modification to any artifact |
| currentStage | PipelineStage | Yes | Last-viewed pipeline stage (for restoring UI state) |
| state | "new" \| "in-progress" \| "specified" | Yes | Derived from artifact content completeness |

### Artifact

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | Yes | Unique identifier |
| projectId | string | Yes | Foreign key to Project.id |
| type | ArtifactType | Yes | One of the artifact types (see enum below) |
| stage | PipelineStage | Yes | Which pipeline stage this artifact belongs to |
| content | string | Yes | Raw markdown content (empty string for new artifacts) |
| sections | Section[] | Yes | Parsed sections from markdown (kept in sync with content) |
| state | "empty" \| "draft" \| "complete" | Yes | Derived from content completeness |
| updatedAt | number (epoch ms) | Yes | Timestamp of last edit |

### Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| headingLevel | number (1-6) | Yes | Markdown heading depth |
| title | string | Yes | Section heading text |
| content | string | Yes | Raw markdown content of this section |
| structuredData | object \| null | No | Parsed structured data for special sections (invariants, lifecycles, behaviors) |
| collapsed | boolean | Yes | UI state — whether the section card is collapsed |

Section is not stored independently in IndexedDB. It is a nested value within Artifact.

## Enums

### ArtifactType

```typescript
type ArtifactType =
  | "spec"          // spec.md
  | "plan"          // plan.md
  | "research"      // research.md
  | "data-model"    // data-model.md
  | "contracts"     // contracts/ (single entry point)
  | "security"      // security.md
  | "events"        // events.md
  | "observability" // observability.md
  | "deployment"    // deployment.md
  | "tasks"         // tasks.md
  | "quickstart"    // quickstart.md
```

### PipelineStage

```typescript
type PipelineStage = "specify" | "clarify" | "plan" | "tasks"
```

### Stage-to-Artifact Mapping

| Stage | Artifacts |
|-------|-----------|
| specify | spec |
| clarify | spec (refined) |
| plan | plan, research, data-model, contracts, security, events, observability, deployment, quickstart |
| tasks | tasks |

## Structured Data Shapes

### Invariant (within Section.structuredData)

```typescript
interface Invariant {
  id: string       // "INV-001", "INV-002", etc.
  rule: string     // The invariant rule text
  scope: string    // Where/when the invariant applies
  violation: string // What happens on violation
}
```

### LifecycleState (within Section.structuredData)

```typescript
interface EntityLifecycle {
  entityName: string
  states: string[]
  transitions: {
    from: string
    to: string
    trigger: string
    guard: string
  }[]
  terminalStates: string[]
  reentryRules: string
}
```

### SystemBehavior (within Section.structuredData)

```typescript
interface SystemBehavior {
  id: string          // "SB-001", "SB-002", etc.
  trigger: string     // When condition
  action: string      // System MUST action
  triggerType: string  // user action, state change, etc.
  failureHandling: string
}
```

## IndexedDB Schema

### Database: `spec-workbench`

**Version**: 1

### Object Stores

#### `projects`

- **Key path**: `id`
- **Indexes**:
  - `by-updated` on `updatedAt` (for sorting project list by last modified)
  - `by-name` on `name` (for alphabetical sorting)

#### `artifacts`

- **Key path**: `id`
- **Indexes**:
  - `by-project` on `projectId` (primary query: get all artifacts for a project)
  - `by-project-type` on `[projectId, type]` (compound: get specific artifact for a project)
  - `by-updated` on `updatedAt` (for global recent-edits view)

## Indexes & Query Patterns

| Query | Index Used | Frequency | Pattern |
|-------|-----------|-----------|---------|
| All projects (sorted by last modified) | `projects.by-updated` | On app load, on project switch | Read-heavy |
| All artifacts for a project | `artifacts.by-project` | On project load, on stage navigation | Read-heavy |
| Specific artifact by project + type | `artifacts.by-project-type` | On artifact open, on auto-save | Read/write balanced |
| Update artifact content | Key path (`id`) | On every auto-save (every 5s during editing) | Write-heavy |

Access pattern is read-heavy on load, write-heavy during editing (auto-save every 5 seconds). IndexedDB transactions are async and non-blocking, so write frequency is not a concern.

## Data Lifecycle

### Persistence

- **Primary store**: IndexedDB (`spec-workbench` database)
- **Backup**: On-demand export to markdown files (user-initiated)
- **No automatic cloud sync** — local-first per constitution

### Retention

- Data persists until the user explicitly deletes a project
- No automatic cleanup or expiration
- Browser storage limits apply (typically 50MB+ for IndexedDB)

### Storage Full Handling

- Monitor `navigator.storage.estimate()` on app load
- Display warning toast when usage exceeds 80% of quota
- Prompt user to export and delete old projects

### Export/Import

- **Export**: Any artifact exports as a standalone `.md` file matching spec-kit format
- **Full project export**: ZIP containing all artifacts as markdown files in spec-kit directory structure
- **Import**: Parse a `.md` file and map sections to the appropriate artifact type and template structure
