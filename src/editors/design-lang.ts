import type { Section } from '../models/artifact'

const SUB_SECTIONS = [
  'Component Vocabulary',
  'Interaction Patterns',
  'Responsive Expectations',
  'Accessibility Requirements',
  'State Presentation',
] as const

interface SubSectionData {
  title: string
  content: string
}

/** Parse design language markdown into sub-sections */
export function parseDesignLanguage(content: string): SubSectionData[] {
  const result: SubSectionData[] = SUB_SECTIONS.map(title => ({ title, content: '' }))
  const lines = content.split('\n')
  let currentIdx = -1
  let contentLines: string[] = []

  for (const line of lines) {
    // Match sub-section headings (any heading level or bold text)
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/) || line.match(/^\*\*(.+)\*\*\s*$/)
    if (headingMatch) {
      const titleText = headingMatch[1].trim()
      const matchIdx = result.findIndex(
        s => s.title.toLowerCase() === titleText.toLowerCase(),
      )
      if (matchIdx >= 0) {
        // Save previous
        if (currentIdx >= 0) {
          result[currentIdx].content = contentLines.join('\n').trim()
        }
        currentIdx = matchIdx
        contentLines = []
        continue
      }
    }

    if (currentIdx >= 0) {
      contentLines.push(line)
    }
  }

  if (currentIdx >= 0) {
    result[currentIdx].content = contentLines.join('\n').trim()
  }

  // If no sub-sections were parsed, put all content in first sub-section
  if (currentIdx === -1 && content.trim()) {
    result[0].content = content.trim()
  }

  return result
}

/** Serialize sub-sections back to markdown */
export function designLanguageToMarkdown(subSections: SubSectionData[]): string {
  return subSections
    .map(s => `#### ${s.title}\n\n${s.content}`)
    .join('\n\n')
}

export function renderDesignLanguageEditor(
  section: Section,
  onUpdate: (content: string) => void,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'structured-editor design-lang-editor'

  const subSections = parseDesignLanguage(section.content)

  function fireUpdate(): void {
    const md = designLanguageToMarkdown(subSections)
    section.content = md
    onUpdate(md)
  }

  for (let i = 0; i < subSections.length; i++) {
    const sub = subSections[i]

    const miniCard = document.createElement('div')
    miniCard.className = 'design-lang-subsection'
    miniCard.style.border = '1px solid var(--color-border)'
    miniCard.style.borderRadius = 'var(--radius-sm)'
    miniCard.style.marginBottom = 'var(--space-2)'
    miniCard.style.overflow = 'hidden'

    // Collapsible header
    const header = document.createElement('button')
    header.style.display = 'flex'
    header.style.alignItems = 'center'
    header.style.gap = 'var(--space-2)'
    header.style.width = '100%'
    header.style.padding = 'var(--space-2) var(--space-3)'
    header.style.background = 'var(--color-surface)'
    header.style.border = 'none'
    header.style.cursor = 'pointer'
    header.style.font = 'inherit'
    header.style.color = 'var(--color-text)'
    header.style.textAlign = 'left'
    header.style.fontWeight = '500'

    const chevron = document.createElement('span')
    chevron.textContent = '\u25B6'
    chevron.style.fontSize = 'var(--text-sm)'
    chevron.style.transition = 'transform 0.15s'
    chevron.style.color = 'var(--color-text-secondary)'
    header.appendChild(chevron)

    const titleSpan = document.createElement('span')
    titleSpan.textContent = sub.title
    header.appendChild(titleSpan)

    miniCard.appendChild(header)

    // Body
    const body = document.createElement('div')
    body.style.display = 'none'
    body.style.padding = 'var(--space-3)'
    body.style.borderTop = '1px solid var(--color-border)'

    const textarea = document.createElement('textarea')
    textarea.className = 'textarea'
    textarea.rows = 5
    textarea.value = sub.content
    const idx = i
    textarea.addEventListener('input', () => {
      subSections[idx].content = textarea.value
      fireUpdate()
    })
    body.appendChild(textarea)
    miniCard.appendChild(body)

    // Toggle
    let expanded = false
    header.addEventListener('click', () => {
      expanded = !expanded
      body.style.display = expanded ? 'block' : 'none'
      chevron.style.transform = expanded ? 'rotate(90deg)' : ''
    })

    container.appendChild(miniCard)
  }

  return container
}
