import type { Section } from '../models/artifact'

export function parseMarkdownSections(content: string): Section[] {
  const lines = content.split('\n')
  const sections: Section[] = []
  let currentSection: Section | null = null
  let contentLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim()
        sections.push(currentSection)
      }
      currentSection = {
        headingLevel: match[1].length,
        title: match[2],
        content: '',
        structuredData: null,
        collapsed: true,
      }
      contentLines = []
    } else {
      contentLines.push(line)
    }
  }

  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim()
    sections.push(currentSection)
  }

  return sections
}

export function parseSectionsToMarkdown(sections: Section[]): string {
  return sections
    .map(s => {
      const heading = '#'.repeat(s.headingLevel) + ' ' + s.title
      return s.content ? heading + '\n\n' + s.content : heading
    })
    .join('\n\n')
}
