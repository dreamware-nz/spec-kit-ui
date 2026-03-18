import type { ArtifactType } from '../models/artifact'

const SPEC_TEMPLATE = `# Feature Specification: [FEATURE NAME]

**Feature Branch**: \`[###-feature-name]\`
**Created**: [DATE]
**Status**: Draft

## Overview

[A concise summary of what is being built and why. What problem does this solve? Who is it for? What is the core value proposition? A reader should understand the purpose and scope of this feature after reading this section.]

## User Scenarios & Testing *(mandatory)*

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

### Edge Cases

- What happens when [boundary condition]?

## System Behaviors

- **SB-001**: When [trigger], the system MUST [action]
  - **Trigger type**: [type]
  - **Failure handling**: [handling]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [specific capability]

### Key Entities

- **[Entity 1]**: [What it represents]

## Invariants

- **INV-001**: [Rule in plain language]
  - **Scope**: [Which entities/operations this constrains]
  - **Violation consequence**: [What happens if broken]

## Entity Lifecycles

### [Entity Name]

**States**: [list states]

| From | To | Trigger | Guard condition |
|------|----|---------|-----------------|
| [state] | [state] | [trigger] | [guard] |

## Design Language

### Component Vocabulary

[UI elements this feature uses]

### Interaction Patterns

[How users interact]

### Accessibility Requirements

[WCAG level, keyboard nav, screen readers]

## Glossary Additions

| Term | Definition | Avoid (synonyms) |
|------|-----------|-------------------|

## Success Criteria *(mandatory)*

- **SC-001**: [Measurable outcome]
`

const PLAN_TEMPLATE = `# Implementation Plan: [FEATURE]

**Branch**: \`[###-feature-name]\` | **Date**: [DATE]

## Summary

[Primary requirement + technical approach]

## Technical Context

**Language/Version**: [e.g., TypeScript 5.x]
**Primary Dependencies**: [e.g., Vite, marked.js]
**Storage**: [e.g., IndexedDB]
**Testing**: [e.g., Vitest]

## Project Structure

\`\`\`text
src/
\`\`\`
`

const SIMPLE_TEMPLATE: Record<string, string> = {
  research: '# Research: [FEATURE]\\n\\n## Decisions\\n\\n| Decision | Rationale | Alternatives |\\n|----------|-----------|-------------|\\n',
  'data-model': '# Data Model: [FEATURE]\\n\\n## Entities\\n\\n## Indexes & Query Patterns\\n\\n## Data Lifecycle\\n',
  contracts: '# Contracts: [FEATURE]\\n\\n## Endpoints\\n',
  security: '# Security Model: [FEATURE]\\n\\n## Authentication\\n\\n## Authorization\\n\\n## Data Classification\\n',
  events: '# Domain Events: [FEATURE]\\n\\n## Event Catalog\\n\\n## Delivery Guarantees\\n',
  observability: '# Observability: [FEATURE]\\n\\n## Key Metrics\\n\\n## Logging Strategy\\n\\n## Alerts\\n',
  deployment: '# Deployment: [FEATURE]\\n\\n## Environment Topology\\n\\n## Infrastructure\\n\\n## Rollback Strategy\\n',
  tasks: '# Tasks: [FEATURE]\\n\\n## Phase 1: Setup\\n\\n- [ ] T001 [task description]\\n',
  quickstart: '# Quickstart: [FEATURE]\\n\\n## Validation Scenarios\\n',
}

export function scaffoldArtifact(type: ArtifactType): string {
  if (type === 'spec') return SPEC_TEMPLATE
  if (type === 'plan') return PLAN_TEMPLATE
  return (SIMPLE_TEMPLATE[type] || '').replace(/\\n/g, '\n')
}

export function scaffoldSpecFromIdea(idea: string): string {
  const date = new Date().toISOString().split('T')[0]
  return SPEC_TEMPLATE
    .replace('[FEATURE NAME]', idea.slice(0, 60))
    .replace('[DATE]', date)
    .replace('[A concise summary of what is being built and why. What problem does this solve? Who is it for? What is the core value proposition? A reader should understand the purpose and scope of this feature after reading this section.]', idea)
    .replace('[Describe this user journey in plain language]', idea)
}
