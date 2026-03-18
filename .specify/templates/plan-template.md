# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
├── security.md          # Phase 1 output, when security signals detected (/speckit.plan command)
├── events.md            # Phase 1 output, when event signals detected (/speckit.plan command)
├── observability.md     # Phase 1 output, when observability signals detected (/speckit.plan command)
├── deployment.md        # Phase 1 output, when deployment signals detected (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Data Model Enrichment

> **Instructions for /speckit.plan**: When generating `data-model.md`, include the standard entity/field/relationship content PLUS the following subsections when signals are present in the spec.

### Indexes & Query Patterns *(include if persistent storage detected)*

- Which fields are queried and how frequently
- Expected access patterns (read-heavy, write-heavy, mixed)
- Recommended indexes with rationale

### Migration Strategy *(include if database detected)*

- How schema changes are applied (versioned migrations, blue-green, expand-contract)
- Rollback approach for failed migrations
- Data backfill strategy if needed

### Data Lifecycle *(include if data retention or compliance mentioned)*

- Retention policy per entity
- Archival rules (when, where, how)
- Soft-delete patterns (if applicable)
- GDPR / right-to-deletion considerations
- Audit trail requirements

### Partitioning / Sharding *(include if large-scale data or high volume mentioned)*

- Partition key selection and rationale
- Shard strategy for large-scale data
- Cross-partition query handling

## Contracts Enrichment

> **Instructions for /speckit.plan**: When generating files in `contracts/`, use a prescribed schema format rather than freeform markdown.

### Prescribed Format

- **REST APIs**: OpenAPI 3.x specification (YAML)
- **GraphQL**: GraphQL SDL schema
- **Event-driven**: AsyncAPI specification (YAML)

### Required Elements Per Endpoint/Operation

Each endpoint or operation in `contracts/` MUST include:

- **Error envelope standard** — consistent error response shape across all endpoints
- **Pagination/filtering/sorting conventions** — standard query parameter patterns (if applicable)
- **Auth per endpoint** — which auth scheme applies, which roles/scopes are required
- **Request/response examples** — at least one happy-path and one error example
- **Rate limiting** — per-endpoint or global limits (if applicable)

## Signal-Based Artifact Generation

> **Instructions for /speckit.plan**: During Phase 1 (Design & Contracts), scan the spec for signals indicating additional artifacts are needed. Generate applicable ones automatically. Skip inapplicable ones silently. At the end, report what was generated and what was skipped with a safety net prompt.

### Detection Table

| Concern | Signals in Spec | Artifact | Template |
|---------|----------------|----------|----------|
| Security | User accounts, personal data, payments, roles, multi-tenancy, API keys, compliance | `security.md` | `templates/security-template.md` |
| Domain Events | System behaviors with async actions, queues, multi-service, eventual consistency | `events.md` | `templates/events-template.md` |
| Observability | Production/SLA/uptime/reliability, logging/metrics/tracing requirements | `observability.md` | `templates/observability-template.md` |
| Deployment | New service, infra changes, migrations, multi-environment | `deployment.md` | `templates/deployment-template.md` |

### Safety Net Prompt

After generating all applicable artifacts, output:

> "I also considered but skipped [list of skipped concerns] because I didn't see signals for them in the spec. Should I generate any of these?"

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
