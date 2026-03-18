import type { Section } from '../models/artifact'

export function renderSectionCard(
  section: Section,
  index: number,
  onUpdate: (index: number, content: string) => void,
): HTMLElement {
  const card = document.createElement('div')
  card.className = 'section-card'
  if (!section.collapsed) card.classList.add('expanded')

  // Header button
  const header = document.createElement('button')
  header.className = 'section-card-header'
  header.setAttribute('aria-expanded', String(!section.collapsed))
  header.setAttribute('aria-level', String(section.headingLevel))
  header.setAttribute('role', 'heading')

  // Chevron
  const chevron = document.createElement('span')
  chevron.className = 'section-card-chevron'
  chevron.textContent = '\u25B6'
  header.appendChild(chevron)

  // Completion indicator
  const indicator = document.createElement('span')
  indicator.className = 'section-card-indicator'
  if (!section.content || section.content.trim().length === 0) {
    indicator.classList.add('section-card-indicator--empty')
  } else if (section.content.trim().length > 20) {
    indicator.classList.add('section-card-indicator--complete')
  } else {
    indicator.classList.add('section-card-indicator--draft')
  }
  header.appendChild(indicator)

  // Title
  const title = document.createElement('span')
  title.className = 'section-card-title'
  title.textContent = section.title
  header.appendChild(title)

  card.appendChild(header)

  // Body region
  const body = document.createElement('div')
  body.className = 'section-card-body'
  body.setAttribute('role', 'region')
  body.setAttribute('aria-label', section.title)

  const textarea = document.createElement('textarea')
  textarea.className = 'textarea'
  textarea.value = section.content
  textarea.rows = 8

  textarea.addEventListener('input', () => {
    onUpdate(index, textarea.value)
  })

  body.appendChild(textarea)
  card.appendChild(body)

  // Toggle collapse/expand
  header.addEventListener('click', () => {
    section.collapsed = !section.collapsed
    card.classList.toggle('expanded')
    header.setAttribute('aria-expanded', String(!section.collapsed))
    if (!section.collapsed) {
      textarea.focus()
    }
  })

  return card
}
