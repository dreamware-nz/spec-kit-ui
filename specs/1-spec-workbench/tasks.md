# Tasks: Spec Workbench

**Input**: Design documents from `/specs/1-spec-workbench/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md, security.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Vite project initialization, dependencies, directory scaffold, CSS design tokens

- [ ] T001 Initialize Vite project with TypeScript strict mode, install dependencies (marked, codemirror, @codemirror/lang-markdown, idb, dompurify) and dev dependencies (vitest, jsdom, @types/dompurify) in `package.json`
- [ ] T002 Create directory scaffold: `src/store/`, `src/models/`, `src/views/`, `src/editors/`, `src/parsers/`, `src/styles/`, `tests/store/`, `tests/models/`, `tests/parsers/`, `tests/editors/`
- [ ] T003 [P] Create `src/styles/reset.css` with minimal CSS reset (box-sizing, margin/padding zero, font inheritance)
- [ ] T004 [P] Create `src/styles/tokens.css` with CSS custom properties for colors (background, surface, text, accent, error, success), spacing scale (4/8/12/16/24/32/48px), typography (font-family, font-sizes, line-heights), border-radius, and transition durations. Ensure minimum 4.5:1 contrast ratio per WCAG AA
- [ ] T005 [P] Create `src/styles/layout.css` with CSS grid layout for app shell: sidebar (250px) + content panel (1fr), full viewport height
- [ ] T006 [P] Create `src/styles/components.css` with base styles for section cards (collapsible container, header, body), toasts (fixed bottom-right), buttons, form inputs, and pipeline indicators (filled/half-filled/empty circles)
- [ ] T007 [P] Create `src/styles/responsive.css` with breakpoint overrides: tablet (768-1024px) collapsible sidebar, mobile (<768px) bottom tab navigation replacing sidebar, no split view. Minimum 375px viewport width
- [ ] T008 [P] Configure Vitest in `vite.config.ts` with jsdom environment for DOM testing
- [ ] T009 Add CSP meta tag to `index.html`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;` per security.md

**Checkpoint**: Project builds, tests run, CSS tokens render correctly

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data layer, state management, markdown parsing, and app shell that ALL user stories depend on

- [ ] T010 Implement IndexedDB operations in `src/store/db.ts`: open database `spec-workbench` v1 with `projects` store (keyPath: `id`, indexes: `by-updated` on `updatedAt`, `by-name` on `name`) and `artifacts` store (keyPath: `id`, indexes: `by-project` on `projectId`, `by-project-type` on `[projectId, type]`, `by-updated` on `updatedAt`). Export CRUD functions: `createProject`, `getProject`, `getAllProjects`, `updateProject`, `deleteProject`, `createArtifact`, `getArtifact`, `getArtifactsByProject`, `getArtifactByProjectAndType`, `updateArtifact`, `deleteArtifact`
- [ ] T011 [P] Write tests for IndexedDB operations in `tests/store/db.test.ts`: verify CRUD for projects and artifacts, verify indexes return correct sort order, verify compound index `by-project-type` lookup
- [ ] T012 Implement in-memory state management in `src/store/state.ts`: reactive state object holding `currentProjectId`, `currentStage`, `currentArtifactId`, `projects` (list), `artifacts` (map by id), `toasts` (queue). Export `getState`, `setState`, `subscribe(listener)` for change notification using a simple pub/sub pattern
- [ ] T013 Implement auto-save sync in `src/store/sync.ts`: debounced save (5-second max delay per INV-003) that writes dirty artifacts to IndexedDB via `db.ts`. Export `markDirty(artifactId)`, `flushAll()` (force-save on navigation), `startAutoSave()`, `stopAutoSave()`. Monitor `navigator.storage.estimate()` on init and warn via toast at 80% quota usage
- [ ] T014 [P] Implement markdown render pipeline in `src/parsers/markdown-io.ts`: `renderMarkdown(input: string): string` using marked.parse() piped through DOMPurify.sanitize() per security.md. Export `markdownToHtml` and `stripMarkdownToText` utilities
- [ ] T015 Implement spec parser in `src/parsers/spec-parser.ts`: `parseMarkdownSections(content: string): Section[]` that splits markdown by headings into Section objects with `headingLevel`, `title`, `content`, `structuredData` (null initially), `collapsed` (true by default). Also `parseSectionsToMarkdown(sections: Section[]): string` for round-trip
- [ ] T016 [P] Write tests for spec parser in `tests/parsers/spec-parser.test.ts`: verify heading extraction at multiple levels, verify round-trip (parse then serialize matches original), verify empty content handling, verify structured data preservation
- [ ] T017 Implement template scaffolding in `src/parsers/template.ts`: `scaffoldArtifact(type: ArtifactType): string` returning markdown template content for each artifact type (spec, plan, research, data-model, contracts, security, events, observability, deployment, tasks, quickstart) matching spec-kit format. `scaffoldSpecFromIdea(idea: string): string` that generates a spec.md template with the idea text pre-filled in the summary section
- [ ] T018 Define TypeScript types in `src/models/project.ts`: export `Project` interface with fields `id`, `name`, `createdAt`, `updatedAt`, `currentStage`, `state`. Export factory function `createProject(name: string): Project` that generates UUID via `crypto.randomUUID()`, sets timestamps, defaults to `specify` stage and `new` state
- [ ] T019 [P] Define TypeScript types in `src/models/artifact.ts`: export `Artifact` interface with fields `id`, `projectId`, `type`, `stage`, `content`, `sections`, `state`, `updatedAt`. Export `ArtifactType` and `Section` types. Export `Invariant`, `EntityLifecycle`, `SystemBehavior` structured data interfaces. Export factory function `createArtifact(projectId, type, stage, content?): Artifact`. Export `STAGE_ARTIFACT_MAP` constant mapping each `PipelineStage` to its `ArtifactType[]`
- [ ] T020 [P] Define pipeline logic in `src/models/pipeline.ts`: export `PipelineStage` type, `PIPELINE_STAGES` ordered array, `getStageCompletion(artifacts: Artifact[], stage: PipelineStage): { total, completed, inProgress }` that checks artifact states. Export `deriveProjectState(artifacts: Artifact[]): "new" | "in-progress" | "specified"` and `deriveArtifactState(content: string, type: ArtifactType): "empty" | "draft" | "complete"`
- [ ] T021 [P] Write tests for pipeline logic in `tests/models/pipeline.test.ts`: verify stage completion calculation, verify project state derivation (new when no content, in-progress when some content, specified when spec complete), verify artifact state transitions per lifecycle in spec.md
- [ ] T022 Implement app shell in `src/views/shell.ts`: create root DOM structure with sidebar container (left) and content panel container (right) using CSS grid from `layout.css`. Wire up `src/main.ts` entry point to initialize DB, load state, render shell, and start auto-save. Import all CSS files

**Checkpoint**: App loads with empty shell, IndexedDB persists data, markdown renders safely, all foundational tests pass

---

## Phase 3: User Story 1 - Ideation to Spec (Priority: P1) MVP

**Goal**: User types a rough idea, gets a structured spec, edits sections inline, exports as markdown

**Independent Test**: User can type an idea, see it structured into spec sections, edit each section, and export the result as a markdown file

### Implementation for User Story 1

- [ ] T023 [US1] Implement empty state view in `src/views/empty-state.ts`: centered prompt "Describe your feature idea to get started" with a large textarea input and "Create Spec" button. On submit, call `scaffoldSpecFromIdea(idea)` from `template.ts`, create project and spec artifact in DB, update state, and transition to content view
- [ ] T024 [US1] Implement auto-save for idea input per SB-001 in `src/views/empty-state.ts`: on 2-second pause after typing, save draft to IndexedDB. Use debounce from `sync.ts`
- [ ] T025 [US1] Implement section card component in `src/editors/section-card.ts`: collapsible container with heading, completion indicator dot, expand/collapse toggle. On expand, render section content. Track collapsed state in Section.collapsed. On expand, move focus to content area per accessibility spec. Use proper heading hierarchy (h1-h4)
- [ ] T026 [P] [US1] Write tests for section card in `tests/editors/section-card.test.ts`: verify collapse/expand toggle, verify heading hierarchy, verify focus management on expand, verify ARIA attributes
- [ ] T027 [US1] Implement CodeMirror markdown editor in `src/editors/markdown.ts`: initialize CodeMirror 6 with markdown language support, line wrapping, basic keybindings. Export `createEditor(container: HTMLElement, content: string, onChange: (content: string) => void): EditorView`. Wire onChange to `markDirty()` from sync.ts for auto-save
- [ ] T028 [US1] Implement content panel with split view in `src/views/content.ts`: left pane shows CodeMirror editor, right pane shows rendered markdown preview via `renderMarkdown()`. Include a draggable splitter divider between panes. Update preview on editor change (debounced 300ms). When viewing a spec artifact, render as a list of section cards instead of raw editor
- [ ] T029 [US1] Implement section-card list rendering in `src/views/content.ts`: when the current artifact is type `spec`, parse content into sections via `parseMarkdownSections()`, render each as a section card. Clicking a section card toggles between preview mode and inline CodeMirror editor for that section. On edit, update section content and re-serialize all sections back to artifact content via `parseSectionsToMarkdown()`
- [ ] T030 [US1] Implement markdown export in `src/views/content.ts`: "Export" button in content panel toolbar that validates markdown against spec-kit template structure (INV-004), warns on structural issues via toast, then triggers file download of artifact content as `.md` file using Blob + URL.createObjectURL
- [ ] T031 [US1] Implement toast notification component in `src/views/toast.ts`: render toast queue from state, auto-dismiss after 3 seconds, support types: success (green), error (red), info (neutral). Show green flash on section header after auto-save. Show toast for export success/failure
- [ ] T032 [US1] Implement markdown file import in `src/views/content.ts`: "Import" button that opens file picker for `.md` files, reads content, calls `parseMarkdownSections()` to map to spec-kit structure (SB-004). On parse error, display errors with line numbers via toast; on success import into current artifact. Sanitize imported content through DOMPurify pipeline per security.md
- [ ] T033 [US1] Wire pipeline completion indicator update per SB-002: when any section is edited, recalculate `deriveArtifactState()` and update pipeline indicators in sidebar within 500ms. Recalculate on every render per INV-002

**Checkpoint**: User Story 1 fully functional. User can type idea, see structured spec, edit inline, import/export markdown. Auto-save works within 5s.

---

## Phase 4: User Story 2 - Pipeline Navigation (Priority: P2)

**Goal**: User sees pipeline stages in sidebar, navigates between them, sees artifact completion, creates artifacts from templates

**Independent Test**: User can see pipeline stages, click between them, see which artifacts exist, and create new ones

### Implementation for User Story 2

- [ ] T034 [US2] Implement sidebar pipeline navigation in `src/views/sidebar.ts`: render pipeline stages (Specify, Clarify, Plan, Tasks) from `PIPELINE_STAGES` with completion indicators (filled/half-filled/empty circles using icons + color, never color alone per accessibility). Clicking a stage updates `currentStage` in state and refreshes content panel
- [ ] T035 [US2] Implement artifact type mapping display in `src/views/sidebar.ts`: under each pipeline stage, list expected artifacts from `STAGE_ARTIFACT_MAP`. Show existing artifacts as clickable links, missing artifacts as grayed-out with "+" create button
- [ ] T036 [US2] Implement stage navigation in `src/views/sidebar.ts`: clicking an artifact link in the sidebar sets `currentArtifactId` in state and renders that artifact in the content panel. Maintain scroll position when switching back
- [ ] T037 [US2] Implement completion indicators per INV-002 in `src/views/sidebar.ts`: for each stage, compute `getStageCompletion()` and render as filled (all complete), half-filled (some artifacts exist), or empty (no artifacts). Update within 500ms of any artifact edit per SB-002
- [ ] T038 [US2] Implement artifact creation from templates per SB-003 in `src/views/sidebar.ts`: clicking "+" on a missing artifact calls `scaffoldArtifact(type)` from `template.ts` to create content with template structure and context from existing artifacts, saves to DB via `createArtifact()`, updates sidebar and navigates to the new artifact
- [ ] T039 [US2] Implement force-save on navigation per INV-003 in `src/views/sidebar.ts`: before switching artifact or stage, call `flushAll()` from `sync.ts` to ensure no content is older than 5 seconds behind editor state

**Checkpoint**: User Story 2 functional. Pipeline stages visible, navigable, artifacts creatable from templates. Completion indicators accurate.

---

## Phase 5: User Story 3 - Section Refinement (Priority: P3)

**Goal**: Specialized structured editors for invariants, lifecycles, behaviors, design language, and drag reorder for user stories

**Independent Test**: User can expand Invariants section, add/edit/remove invariants with structured fields, and see them in the spec

### Implementation for User Story 3

- [ ] T040 [US3] Implement invariant structured editor in `src/editors/invariant.ts`: render list of existing invariants from `Section.structuredData`. "Add Invariant" button creates a new form with fields: rule (textarea), scope (text input), violation consequence (textarea). Auto-number as INV-001, INV-002, etc. On save, update `structuredData` and re-serialize to markdown format matching spec-kit template
- [ ] T041 [US3] Implement lifecycle table editor in `src/editors/lifecycle.ts`: render `EntityLifecycle` data as an editable table with columns: From, To, Trigger, Guard condition. Editable states list, terminal states checkboxes, re-entry rules textarea. Entity name as a heading. On change, update `structuredData` and re-serialize to markdown table format
- [ ] T042 [US3] Implement system behavior editor in `src/editors/behavior.ts`: render list of `SystemBehavior` entries. "Add Behavior" button creates form with fields: trigger (textarea), action (textarea), trigger type (dropdown: user action, state change, user action side-effect), failure handling (textarea). Auto-number as SB-001, SB-002, etc. On save, update `structuredData` and re-serialize to markdown
- [ ] T043 [US3] Implement design language editors in `src/editors/design-lang.ts`: for Component Vocabulary section, render editable list of components with fields: name, purpose, relationships. For Interaction Patterns, render as editable list items. For Responsive Expectations and Accessibility Requirements, render as editable lists with breakpoint/rule fields
- [ ] T044 [US3] Implement drag reorder for user stories in `src/editors/section-card.ts`: when inside a "User Stories" parent section, enable drag handles on section cards. On drop, reorder sections array and re-serialize to markdown. Update priority labels (P1, P2, P3) based on new order. Use native HTML5 drag and drop API
- [ ] T045 [US3] Wire structured editors into section cards in `src/views/content.ts`: when expanding a section card, detect section type by title (Invariants, Entity Lifecycles, System Behaviors, Design Language) and render the appropriate structured editor instead of the plain markdown editor. Parse `structuredData` from section content on expand, serialize back on change
- [ ] T046 [US3] Implement structured data parsing in `src/parsers/spec-parser.ts`: add `parseInvariants(content: string): Invariant[]`, `parseLifecycles(content: string): EntityLifecycle[]`, `parseBehaviors(content: string): SystemBehavior[]` that extract structured data from markdown sections. Add corresponding `serializeInvariants`, `serializeLifecycles`, `serializeBehaviors` for round-trip

**Checkpoint**: All structured editors functional. Invariants, lifecycles, behaviors editable via forms. User stories drag-reorderable.

---

## Phase 6: User Story 4 - Multi-Project Management (Priority: P4)

**Goal**: Project list in sidebar, create/switch/delete projects, each with independent state

**Independent Test**: User can create a second project, switch between them, each retains state independently

### Implementation for User Story 4

- [ ] T047 [US4] Implement project list in `src/views/sidebar.ts`: render project list above pipeline stages, sorted by `updatedAt` descending. Each project shows name and state indicator. Active project highlighted. Scrollable if many projects
- [ ] T048 [US4] Implement project creation in `src/views/sidebar.ts`: "New Project" button at top of project list. Inline name input field. On submit, call `createProject(name)`, create default spec.md artifact (INV-001: project always has at least spec.md), save to DB, switch to new project
- [ ] T049 [US4] Implement project switching in `src/views/sidebar.ts`: clicking a project in the list calls `flushAll()` (force-save current), loads the selected project's artifacts from DB via `getArtifactsByProject()`, updates state (`currentProjectId`, `currentStage` from project.currentStage, `artifacts`), re-renders sidebar pipeline and content panel
- [ ] T050 [US4] Implement project deletion in `src/views/sidebar.ts`: delete button per project (with confirmation dialog). Delete project and all its artifacts from DB. If deleting the current project, switch to the most recent remaining project or show empty state. Prevent deletion if it is the only project (or allow, showing empty state)
- [ ] T051 [US4] Implement project rename in `src/views/sidebar.ts`: double-click project name to edit inline. On blur or Enter, save updated name to DB

**Checkpoint**: Multi-project management works. Projects create, switch, delete independently with persisted state.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Keyboard navigation, command palette, responsiveness, accessibility, security hardening

- [ ] T052 [P] Implement keyboard navigation in `src/views/shell.ts`: Tab between sections, Enter to expand section card, Escape to collapse. Arrow keys to navigate sidebar items. Focus trapping within modals/dialogs. Ensure all interactive elements are keyboard-accessible per SC-006
- [ ] T053 [P] Implement command palette in `src/views/shell.ts`: Ctrl/Cmd+K opens overlay with fuzzy-search across actions: new project, export artifact, import markdown, navigate to section, switch project, switch pipeline stage. Escape to close. Render as a modal input with filtered results list
- [ ] T054 [P] Implement responsive CSS in `src/styles/responsive.css`: verify and refine tablet breakpoint (768-1024px) hamburger menu toggle for sidebar, mobile breakpoint (<768px) bottom tab navigation, single-panel content, no split view. Test at 375px minimum width
- [ ] T055 [P] Implement skeleton loading placeholders in `src/views/content.ts`: show animated skeleton UI matching section card layout while project data loads from IndexedDB. Replace with actual content once loaded
- [ ] T056 [P] Implement error state rendering in `src/views/content.ts`: red-bordered section card with error message and retry button for parse/validation failures. Display parse errors with line numbers for import failures per SB-004
- [ ] T057 [P] Implement storage quota warning in `src/store/sync.ts`: on app load, check `navigator.storage.estimate()`. If usage > 80% of quota, display warning toast prompting user to export and delete old projects
- [ ] T058 [P] XSS sanitization audit: verify all paths where user content enters the DOM go through `renderMarkdown()` (DOMPurify pipeline). Verify no raw `innerHTML` usage with unsanitized user strings. Verify CSP meta tag is present in `index.html`. Verify imported markdown is sanitized per security.md
- [ ] T059 [P] Accessibility audit in all views: verify ARIA labels on editor (screen reader support), proper heading hierarchy (h1-h4), focus management on section expand, color never sole state indicator (icons + color for pipeline), minimum 4.5:1 contrast ratio on all text per spec.md accessibility requirements
- [ ] T060 [P] Implement virtualized scrolling for long section lists in `src/views/content.ts`: for specs with many sections, only render visible section cards plus a buffer. Lazy-render large markdown blocks to maintain <100ms keystroke response per edge case in spec.md
- [ ] T061 [P] Implement section collapse state persistence in `src/editors/section-card.ts`: save collapsed/expanded state of each section card in the artifact's `sections` array and persist to IndexedDB so sections remember their state across sessions
- [ ] T062 Performance validation: verify <2s initial load (SC-005), <500ms pipeline indicator update (SB-002), <100ms editor keystroke response. Profile and optimize if needed. Verify <500KB initial bundle size

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational. This is the MVP.
- **US2 (Phase 4)**: Depends on Foundational. Can run in parallel with US1 (sidebar vs content panel), but integration depends on US1 content panel existing
- **US3 (Phase 5)**: Depends on US1 (section cards must exist before adding structured editors)
- **US4 (Phase 6)**: Depends on Foundational. Can run in parallel with US1-US3 (sidebar project list is independent)
- **Polish (Phase 7)**: Depends on all user stories being complete

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003-T008 are independent CSS/config files)
- Foundational: T011, T014, T016, T019, T020, T021 can run in parallel
- US1: T026 (tests) can run in parallel with other US1 tasks
- US2: T034-T038 are sequential (sidebar builds incrementally)
- US3: T040-T043 [P] can run in parallel (independent editor files)
- US4: T047-T051 are sequential (project list before CRUD)
- All Polish tasks marked [P] can run in parallel

### Within Each User Story

- Models/types before views
- Store operations before UI that depends on them
- Core implementation before integration
- Story complete before moving to next priority
