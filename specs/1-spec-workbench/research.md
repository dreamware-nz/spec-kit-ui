# Research: Spec Workbench

**Branch**: `1-spec-workbench` | **Date**: 2026-03-18
**Purpose**: Evaluate technology choices for the Spec Workbench implementation.

## Markdown Rendering: marked.js vs markdown-it vs remark

### Options Evaluated

| Library | Bundle Size (min+gz) | Parse Speed | Extensibility | GFM Tables |
|---------|---------------------|-------------|---------------|------------|
| marked.js | ~8KB | Fastest | Plugin hooks | Built-in |
| markdown-it | ~30KB | Fast | Rich plugin ecosystem | Plugin |
| remark (unified) | ~50KB+ | Moderate | AST-based, highly composable | Plugin |

### Decision: marked.js

**Rationale**: marked.js is the smallest and fastest option. It supports GFM tables out of the box, which we need for lifecycle state tables and other structured spec sections. Its plugin hooks are sufficient for our needs (custom heading IDs, section extraction). We do not need remark's AST manipulation or markdown-it's extensive plugin ecosystem — our use case is rendering spec markdown with minor customizations.

**Trade-offs accepted**: Less extensible than remark for complex AST transforms. If we later need advanced markdown manipulation (e.g., programmatic section reordering), we may need to add a lightweight AST layer. This is acceptable for MVP.

## Code Editing: CodeMirror 6 vs Monaco vs textarea

### Options Evaluated

| Editor | Bundle Size | Mobile Support | Modularity | Setup Complexity |
|--------|-------------|----------------|------------|-----------------|
| CodeMirror 6 | ~150KB (core + markdown) | Good | Excellent — import only what you need | Moderate |
| Monaco | ~2MB+ | Poor | Monolithic | Low (but heavy) |
| Plain textarea | 0KB | Native | N/A | Trivial |

### Decision: CodeMirror 6

**Rationale**: CodeMirror 6 is modular — we import only the markdown language support and basic editing extensions, keeping bundle size reasonable. It provides syntax highlighting, proper undo/redo, bracket matching, and mobile keyboard support that a plain textarea lacks. Monaco is far too heavy for our use case (it bundles the entire VS Code editor engine) and has poor mobile support.

**Trade-offs accepted**: More setup than a textarea. Adds ~150KB to the bundle. Worth it for the editing experience, especially for users writing markdown with code blocks, tables, and frontmatter.

## Persistence: IndexedDB vs localStorage

### Options Evaluated

| Storage | Capacity | Data Types | Async | Structured Queries |
|---------|----------|------------|-------|-------------------|
| IndexedDB | 50MB-unlimited (browser-dependent) | Structured (objects, blobs) | Yes | Yes (indexes) |
| localStorage | 5-10MB | Strings only | No (blocks main thread) | No |

### Decision: IndexedDB via idb library

**Rationale**: A single project with all its artifacts can easily reach 500KB+ of markdown content. With 10-20 projects, localStorage's 5-10MB limit becomes a real constraint. IndexedDB provides structured storage with indexes (query artifacts by projectId, by type), async operations that don't block the UI, and effectively unlimited capacity. The `idb` library (~1KB) provides a clean Promise-based wrapper over the raw IndexedDB API.

**Trade-offs accepted**: IndexedDB API is more complex than localStorage. The `idb` wrapper mitigates this. Debugging is slightly harder (DevTools IndexedDB inspector vs. simple key-value view). Acceptable given the capacity and performance benefits.

## Build Tool: Vite vs esbuild vs Parcel

### Options Evaluated

| Tool | HMR Speed | TypeScript | Config Complexity | Ecosystem |
|------|-----------|------------|-------------------|-----------|
| Vite | Instant (<50ms) | Native | Minimal | Large (Vitest, plugins) |
| esbuild | N/A (bundler, not dev server) | Native | Manual setup | Minimal |
| Parcel | Fast | Native | Zero-config | Moderate |

### Decision: Vite

**Rationale**: Vite provides the best developer experience with instant HMR, native TypeScript support, and minimal configuration. It pairs naturally with Vitest for testing (shared config, same transform pipeline). esbuild is a bundler, not a dev server — we'd need to build our own HMR and dev workflow. Parcel's zero-config approach is appealing but Vite's ecosystem (plugins, Vitest integration) gives it the edge.

**Trade-offs accepted**: Adds a build tool dependency. A plain `<script type="module">` approach would be simpler per the constitution's simplicity principle, but the DX benefits (HMR, TypeScript compilation, CSS imports, test runner integration) justify this.

## CSS Approach: No Framework

**Decision**: Plain CSS with CSS custom properties (design tokens) for theming.

**Rationale**: The constitution calls for simplicity. A CSS framework (Tailwind, etc.) adds build complexity, learning curve, and bundle size. Our component count is small (~15 distinct UI components). CSS custom properties provide theming, and modern CSS features (flexbox, grid, container queries) handle our layout needs. A minimal reset plus well-organized stylesheets is sufficient.
