import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../../src/llm/system-prompt'

describe('buildSystemPrompt', () => {
  it('includes role and template structure', () => {
    const prompt = buildSystemPrompt('', null, 'specify', [])
    expect(prompt).toContain('product discovery partner')
    expect(prompt).toContain('User Scenarios & Testing')
    expect(prompt).toContain('Invariants')
    expect(prompt).toContain('Entity Lifecycles')
    expect(prompt).toContain('SPEC_UPDATE')
  })

  it('includes spec content when provided', () => {
    const prompt = buildSystemPrompt('## Requirements\n\n- FR-001: Test', null, 'specify', [])
    expect(prompt).toContain('FR-001: Test')
  })

  it('includes focus section when set', () => {
    const prompt = buildSystemPrompt('', 'Invariants', 'specify', [])
    expect(prompt).toContain('focused on the "Invariants" section')
  })

  it('includes glossary terms when provided', () => {
    const prompt = buildSystemPrompt('', null, 'specify', ['Order', 'Album'])
    expect(prompt).toContain('Order, Album')
  })

  it('includes pipeline stage', () => {
    const prompt = buildSystemPrompt('', null, 'specify', [])
    expect(prompt).toContain('Current stage: specify')
  })

  // T028: Signal detection verification
  it('includes signal detection patterns for lifecycle/invariant/behavior/design-language', () => {
    const prompt = buildSystemPrompt('', null, 'specify', [])
    expect(prompt).toContain('status')
    expect(prompt).toContain('lifecycle')
    expect(prompt).toContain('must never')
    expect(prompt).toContain('invariant')
    expect(prompt).toContain('system behavior')
    expect(prompt).toContain('design language')
  })

  // T024: Multi-feature context
  it('includes other feature summaries when provided', () => {
    const prompt = buildSystemPrompt('', null, 'specify', [], {
      otherFeatureSummaries: ['Auth (5/10 sections filled)', 'Payments (3/10 sections filled)'],
    })
    expect(prompt).toContain('Auth (5/10 sections filled)')
    expect(prompt).toContain('Other Features in This Project')
  })

  // T025: Cross-feature entities
  it('includes cross-feature entity names when provided', () => {
    const prompt = buildSystemPrompt('', null, 'specify', [], {
      crossFeatureEntities: ['User', 'Order'],
    })
    expect(prompt).toContain('User, Order')
    expect(prompt).toContain('Shared Entities')
  })

  // T029: Safety-net at 80% coverage
  it('includes safety-net when coverage >= 80%', () => {
    const prompt = buildSystemPrompt('', null, 'specify', [], {
      coveragePercent: 85,
      uncoveredSections: ['Security', 'Observability'],
      safetyNetFired: false,
    })
    expect(prompt).toContain('Coverage is at 85%')
    expect(prompt).toContain('Security, Observability')
  })

  it('does not include safety-net when already fired', () => {
    const prompt = buildSystemPrompt('', null, 'specify', [], {
      coveragePercent: 85,
      uncoveredSections: ['Security'],
      safetyNetFired: true,
    })
    expect(prompt).not.toContain('Coverage Safety Net')
  })

  // T034: Plan-stage conversation
  it('uses plan-stage prompt when pipeline is plan', () => {
    const prompt = buildSystemPrompt('', null, 'plan', [])
    expect(prompt).toContain('technical planning partner')
    expect(prompt).toContain('tech stack')
    expect(prompt).toContain('Current stage: plan')
  })

  // T036: Stage progression suggestion at 90%
  it('suggests stage progression at 90%+ coverage', () => {
    const prompt = buildSystemPrompt('', null, 'specify', [], {
      coveragePercent: 92,
    })
    expect(prompt).toContain('Stage Progression')
    expect(prompt).toContain('technical plan')
  })
})
