# Implementation Plan: Spec Workbench

**Branch**: `1-spec-workbench` | **Date**: 2026-03-18 | **Spec**: `specs/1-spec-workbench/spec.md`
**Input**: Feature specification from `/specs/1-spec-workbench/spec.md`

## Summary

Build a browser-based workbench for iteratively developing specifications using the spec-kit pipeline. Users type a rough idea and progressively refine it into a structured specification with specialized editors for invariants, entity lifecycles, system behaviors, and design language sections. The application is local-first with no server dependency, persisting all data to IndexedDB.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Vite (build), marked.js (markdown rendering), CodeMirror 6 (editing), idb (IndexedDB wrapper)
**Storage**: IndexedDB via idb library (localStorage is too small for multiple projects with full markdown content)
**Testing**: Vitest + jsdom (unit/integration), Playwright (e2e, future)
**Target Platform**: Modern browsers (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+)
**Project Type**: Single-page web application (static site, no backend)
**Performance Goals**: < 2s initial load, < 500ms pipeline indicator update, < 100ms editor keystroke response
**Constraints**: Offline-capable, no server dependency, all data local, < 500KB initial bundle
**Scale/Scope**: Single user, 1-20 projects, each project with ~12 artifacts of 1-50KB markdown each

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Spec-First, Always | PASS | Spec written and reviewed before any implementation code. Plan follows spec. |
| II. Incremental Disclosure | PASS | Users start with a rough idea and progressively refine through pipeline stages. No stage requires completing previous stages. Free navigation between stages. |
| III. Simplicity Over Features | PASS | Vanilla DOM manipulation, no framework. Minimal dependencies (marked.js, CodeMirror 6, idb). No CSS framework. No build complexity beyond Vite. |
| IV. Local-First | PASS | All data in IndexedDB. No server required. Works as a static site. Export/import for portability. |
| V. Markdown as Truth | PASS | All artifacts stored as markdown strings. The UI parses and renders markdown. Export produces standard spec-kit markdown files. |
| VI. Pipeline Awareness | PASS | Sidebar shows pipeline stages (Specify, Clarify, Plan, Tasks) with completion indicators. Navigation between stages shows relevant artifacts. |
| VII. Test-First Development | PASS | Vitest configured from the start. Tests written before implementation for each module. |

## Project Structure

### Documentation (this feature)

```text
specs/1-spec-workbench/
├── plan.md              # This file
├── research.md          # Technology selection rationale
├── data-model.md        # Entity definitions and storage design
├── security.md          # Security model (minimal — local-only app)
├── contracts/           # No external APIs — internal interfaces only
├── checklists/          # Pre-existing checklists
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main.ts              # Entry point, app initialization
├── store/
│   ├── db.ts            # IndexedDB operations via idb
│   ├── state.ts         # In-memory state management
│   └── sync.ts          # Auto-save, state↔DB sync
├── models/
│   ├── project.ts       # Project entity
│   ├── artifact.ts      # Artifact entity with type/stage mapping
│   └── pipeline.ts      # Pipeline stages, completion logic
├── views/
│   ├── shell.ts         # App shell (sidebar + content layout)
│   ├── sidebar.ts       # Project list + pipeline navigation
│   ├── content.ts       # Content panel (editor + preview split)
│   ├── empty-state.ts   # New project welcome/idea input
│   └── toast.ts         # Toast notifications
├── editors/
│   ├── markdown.ts      # CodeMirror markdown editor
│   ├── section-card.ts  # Collapsible section container
│   ├── invariant.ts     # Structured INV-### editor
│   ├── lifecycle.ts     # State machine table editor
│   ├── behavior.ts      # SB-### structured editor
│   └── design-lang.ts   # Design language section editors
├── parsers/
│   ├── spec-parser.ts   # Parse spec.md into sections
│   ├── markdown-io.ts   # Read/write markdown ↔ structured data
│   └── template.ts      # Load and scaffold from templates
└── styles/
    ├── reset.css         # Minimal reset
    ├── tokens.css        # CSS custom properties (colors, spacing, typography)
    ├── layout.css        # Shell, sidebar, content panel layout
    ├── components.css    # Section cards, editors, toasts
    └── responsive.css    # Breakpoint overrides
tests/
├── store/
│   └── db.test.ts
├── models/
│   └── pipeline.test.ts
├── parsers/
│   └── spec-parser.test.ts
└── editors/
    └── section-card.test.ts
```

**Structure Decision**: Single-project structure (no frontend/backend split). This is a client-only SPA with no server component. All source lives under `src/` with a clear separation between data layer (`store/`, `models/`), presentation (`views/`, `editors/`), and data transformation (`parsers/`). Styles are plain CSS files imported by Vite.

## Complexity Tracking

*No constitution violations detected. No complexity justifications needed.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
