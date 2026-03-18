---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
scripts:
  sh: scripts/bash/setup-plan.sh --json
  ps: scripts/powershell/setup-plan.ps1 -Json
agent_scripts:
  sh: scripts/bash/update-agent-context.sh __AGENT__
  ps: scripts/powershell/update-agent-context.ps1 -AgentType __AGENT__
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `{SCRIPT}` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md (enriched), contracts/ (prescribed format), quickstart.md, plus signal-detected artifacts (security.md, events.md, observability.md, deployment.md when applicable)
   - Phase 1: Update agent context by running the agent script
   - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after Phase 2 planning. Report:
   - Branch, IMPL_PLAN path, and generated artifacts
   - **Safety net**: "I also considered but skipped [list of skipped artifacts] because I didn't see signals for them in the spec. Should I generate any of these?"

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable
   - **Indexes & Query Patterns** (if persistent storage): queried fields, access patterns, index recommendations
   - **Migration Strategy** (if database): migration approach, rollback, backfill
   - **Data Lifecycle** (if retention/compliance mentioned): retention policy, archival, soft-delete, GDPR
   - **Partitioning / Sharding** (if large-scale data): partition key, shard strategy

2. **Define interface contracts** (if project has external interfaces) → `/contracts/`:
   - Identify what interfaces the project exposes to users or other systems
   - Document the contract format appropriate for the project type
   - Examples: public APIs for libraries, command schemas for CLI tools, endpoints for web services, grammars for parsers, UI contracts for applications
   - **Prescribed formats**: Use OpenAPI 3.x for REST, GraphQL SDL for GraphQL, AsyncAPI for event-driven — not freeform markdown
   - **Required per endpoint/interface**: error envelope, auth requirements, request/response examples, rate limits (if applicable)
   - Skip if project is purely internal (build scripts, one-off tools, etc.)

3. **Signal-based artifact generation** from spec content:

   Scan the spec for signals and generate additional artifacts when detected:

   | If spec contains... | Generate | Using template |
   |---------------------|----------|---------------|
   | User accounts, personal data, payments, roles, multi-tenancy, API keys, compliance | `SPECS_DIR/security.md` | `templates/security-template.md` |
   | System behaviors with async actions, queues, multi-service, eventual consistency | `SPECS_DIR/events.md` | `templates/events-template.md` |
   | Production/SLA/uptime/reliability, logging/metrics/tracing requirements | `SPECS_DIR/observability.md` | `templates/observability-template.md` |
   | New service, infra changes, migrations, multi-environment | `SPECS_DIR/deployment.md` | `templates/deployment-template.md` |

   For each detected artifact:
   - Copy the template to SPECS_DIR
   - Fill in feature-specific content based on spec requirements and research findings
   - Remove template sections that don't apply

   For skipped artifacts: note them for the safety net prompt in step 4.

4. **Agent context update**:
   - Run `{AGENT_SCRIPT}`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md (enriched), /contracts/* (prescribed format), quickstart.md, agent-specific file, plus signal-detected artifacts: security.md, events.md, observability.md, deployment.md (when applicable)

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
