import { describe, it, expect } from 'vitest'
import { parseMarkdownSections, parseSectionsToMarkdown } from '../../src/parsers/spec-parser'

describe('parseMarkdownSections', () => {
  it('extracts headings at multiple levels', () => {
    const md = '# Title\n\nContent\n\n## Section\n\nMore content\n\n### Sub\n\nDeep'
    const sections = parseMarkdownSections(md)
    expect(sections).toHaveLength(3)
    expect(sections[0].headingLevel).toBe(1)
    expect(sections[0].title).toBe('Title')
    expect(sections[1].headingLevel).toBe(2)
    expect(sections[2].headingLevel).toBe(3)
  })

  it('preserves content between headings', () => {
    const md = '# Title\n\nParagraph one\n\nParagraph two\n\n## Next\n\nContent'
    const sections = parseMarkdownSections(md)
    expect(sections[0].content).toContain('Paragraph one')
    expect(sections[0].content).toContain('Paragraph two')
  })

  it('handles empty content', () => {
    const sections = parseMarkdownSections('')
    expect(sections).toHaveLength(0)
  })

  it('round-trips correctly', () => {
    const md = '# Title\n\nContent here\n\n## Section Two\n\nMore content'
    const sections = parseMarkdownSections(md)
    const result = parseSectionsToMarkdown(sections)
    expect(result).toBe(md)
  })

  it('defaults collapsed to true', () => {
    const sections = parseMarkdownSections('# Title\n\nContent')
    expect(sections[0].collapsed).toBe(true)
  })
})
