# Spec Kit UI Constitution

## Core Principles

### I. Spec-First, Always
Every feature in Spec Kit UI MUST begin with a specification. The UI itself is a tool for creating and managing specifications — it must embody the methodology it enables. Changes to the UI require spec updates first.

### II. Incremental Disclosure
The interface MUST support incremental workflow — users start with a rough idea and progressively refine it through structured stages. No stage should require completing all previous stages perfectly. Users can navigate freely between stages and refine as understanding grows.

### III. Simplicity Over Features
Start with the minimum viable interface. Use vanilla web technologies where possible. Avoid frameworks that add complexity without clear benefit. A single HTML file that works is better than an elaborate build system that doesn't ship.

### IV. Local-First
All data MUST be stored locally by default. No server required for basic operation. The UI should work as a static site with browser-local persistence. Server features (collaboration, sync) are additive, never required.

### V. Markdown as Truth
Specifications are markdown files. The UI reads and writes markdown. The canonical form of every artifact is a markdown file on disk. The UI is a lens for viewing and editing these files, not a replacement for them.

### VI. Pipeline Awareness
The UI MUST reflect the spec-kit pipeline stages (constitution → specify → clarify → plan → tasks → implement). Navigation, progress tracking, and artifact relationships should make the pipeline visible and navigable.

### VII. Test-First Development
All implementation MUST follow test-driven development. Write failing tests before implementation code. Use integration tests that exercise real browser behavior.

## Development Workflow

- All changes go through feature branches
- Specs before code, tests before implementation
- Commit after each logical unit of work
- Keep dependencies minimal

## Governance

This constitution supersedes all other practices. Amendments require explicit documentation of rationale, review, and a backwards compatibility assessment.

**Version**: 1.0.0 | **Ratified**: 2026-03-18 | **Last Amended**: 2026-03-18
