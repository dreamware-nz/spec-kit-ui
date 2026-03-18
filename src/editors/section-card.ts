import type { Section, Invariant, EntityLifecycle, SystemBehavior } from '../models/artifact'
import { renderInvariantEditor } from './invariant'
import { renderLifecycleEditor } from './lifecycle'
import { renderBehaviorEditor } from './behavior'
import { renderDesignLanguageEditor } from './design-lang'

type StructuredData = Invariant[] | EntityLifecycle | SystemBehavior[]

function isInvariantSection(title: string): boolean {
  return /invariants?$/i.test(title.trim())
}

function isLifecycleSection(title: string): boolean {
  return /entity\s+lifecycles?$/i.test(title.trim())
}

function isBehaviorSection(title: string): boolean {
  return /system\s+behaviors?$/i.test(title.trim())
}

function isDesignLanguageSection(title: string): boolean {
  return /design\s+language$/i.test(title.trim())
}

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

  // T045: Choose structured editor or textarea based on section title
  if (isInvariantSection(section.title)) {
    const editor = renderInvariantEditor(section, (_data: StructuredData) => {
      onUpdate(index, section.content)
    })
    body.appendChild(editor)
  } else if (isLifecycleSection(section.title)) {
    const editor = renderLifecycleEditor(section, (_data: StructuredData) => {
      onUpdate(index, section.content)
    })
    body.appendChild(editor)
  } else if (isBehaviorSection(section.title)) {
    const editor = renderBehaviorEditor(section, (_data: StructuredData) => {
      onUpdate(index, section.content)
    })
    body.appendChild(editor)
  } else if (isDesignLanguageSection(section.title)) {
    const editor = renderDesignLanguageEditor(section, (_content: string) => {
      onUpdate(index, section.content)
    })
    body.appendChild(editor)
  } else {
    const textarea = document.createElement('textarea')
    textarea.className = 'textarea'
    textarea.value = section.content
    textarea.rows = 8

    textarea.addEventListener('input', () => {
      onUpdate(index, textarea.value)
    })

    body.appendChild(textarea)
  }

  card.appendChild(body)

  // Toggle collapse/expand
  header.addEventListener('click', () => {
    section.collapsed = !section.collapsed
    card.classList.toggle('expanded')
    header.setAttribute('aria-expanded', String(!section.collapsed))
    if (!section.collapsed) {
      const firstInput = body.querySelector<HTMLElement>('textarea, input, select')
      if (firstInput) firstInput.focus()
    }
  })

  return card
}
