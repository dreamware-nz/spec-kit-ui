import { describe, it, expect } from 'vitest'
import { createResponseParser } from '../../src/llm/response-parser'
import type { SpecUpdate } from '../../src/models/conversation'

describe('createResponseParser', () => {
  it('passes plain text through', () => {
    const texts: string[] = []
    const parser = createResponseParser({
      onText: (t) => texts.push(t),
      onSpecUpdate: () => {},
    })
    parser.feed('Hello world')
    parser.flush()
    expect(texts.join('')).toBe('Hello world')
  })

  it('extracts a single spec update', () => {
    const updates: SpecUpdate[] = []
    const texts: string[] = []
    const parser = createResponseParser({
      onText: (t) => texts.push(t),
      onSpecUpdate: (u) => updates.push(u),
    })
    parser.feed('Before <<<SPEC_UPDATE section="Requirements" action="append">>>New content<<<END_UPDATE>>> After')
    parser.flush()
    expect(updates).toHaveLength(1)
    expect(updates[0].section).toBe('Requirements')
    expect(updates[0].content).toBe('New content')
    expect(updates[0].action).toBe('append')
    expect(texts.join('')).toContain('Before')
    expect(texts.join('')).toContain('After')
  })

  it('handles multiple updates interleaved with text', () => {
    const updates: SpecUpdate[] = []
    const parser = createResponseParser({
      onText: () => {},
      onSpecUpdate: (u) => updates.push(u),
    })
    parser.feed('Text <<<SPEC_UPDATE section="A" action="create">>>Content A<<<END_UPDATE>>> Middle <<<SPEC_UPDATE section="B" action="replace">>>Content B<<<END_UPDATE>>> End')
    parser.flush()
    expect(updates).toHaveLength(2)
    expect(updates[0].section).toBe('A')
    expect(updates[1].section).toBe('B')
  })

  it('handles streaming (token-by-token)', () => {
    const updates: SpecUpdate[] = []
    const parser = createResponseParser({
      onText: () => {},
      onSpecUpdate: (u) => updates.push(u),
    })
    const full = 'Hi <<<SPEC_UPDATE section="Test" action="replace">>>Content<<<END_UPDATE>>> Done'
    for (const char of full) {
      parser.feed(char)
    }
    parser.flush()
    expect(updates).toHaveLength(1)
    expect(updates[0].content).toBe('Content')
  })

  it('flushes unclosed update as text', () => {
    const texts: string[] = []
    const parser = createResponseParser({
      onText: (t) => texts.push(t),
      onSpecUpdate: () => {},
    })
    parser.feed('Text <<<SPEC_UPDATE section="X" action="replace">>>Unclosed content')
    parser.flush()
    expect(texts.join('')).toContain('Unclosed content')
  })
})
