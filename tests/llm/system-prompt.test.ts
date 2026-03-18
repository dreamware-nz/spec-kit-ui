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
    const prompt = buildSystemPrompt('', null, 'plan', [])
    expect(prompt).toContain('Current stage: plan')
  })
})
