import { describe, it, expect, vi } from 'vitest'
import { renderSectionCard } from '../../src/editors/section-card'
import type { Section } from '../../src/models/artifact'

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    headingLevel: 2,
    title: 'Test Section',
    content: 'Some content here',
    structuredData: null,
    collapsed: true,
    ...overrides,
  }
}

describe('renderSectionCard', () => {
  it('renders collapsed by default and expands on click', () => {
    const section = makeSection()
    const card = renderSectionCard(section, 0, vi.fn())

    expect(card.classList.contains('expanded')).toBe(false)

    const header = card.querySelector('.section-card-header') as HTMLButtonElement
    header.click()

    expect(card.classList.contains('expanded')).toBe(true)
    expect(section.collapsed).toBe(false)
  })

  it('collapses on second click', () => {
    const section = makeSection({ collapsed: false })
    const card = renderSectionCard(section, 0, vi.fn())

    expect(card.classList.contains('expanded')).toBe(true)

    const header = card.querySelector('.section-card-header') as HTMLButtonElement
    header.click()

    expect(card.classList.contains('expanded')).toBe(false)
    expect(section.collapsed).toBe(true)
  })

  it('renders heading with correct aria-level', () => {
    const section = makeSection({ headingLevel: 3 })
    const card = renderSectionCard(section, 0, vi.fn())
    const header = card.querySelector('.section-card-header') as HTMLButtonElement

    expect(header.getAttribute('aria-level')).toBe('3')
    expect(header.getAttribute('role')).toBe('heading')
  })

  it('has correct ARIA attributes', () => {
    const section = makeSection()
    const card = renderSectionCard(section, 0, vi.fn())

    const header = card.querySelector('.section-card-header') as HTMLButtonElement
    expect(header.getAttribute('aria-expanded')).toBe('false')

    const body = card.querySelector('.section-card-body') as HTMLElement
    expect(body.getAttribute('role')).toBe('region')

    // After expand
    header.click()
    expect(header.getAttribute('aria-expanded')).toBe('true')
  })

  it('calls onUpdate when textarea content changes', () => {
    const onUpdate = vi.fn()
    const section = makeSection({ collapsed: false })
    const card = renderSectionCard(section, 2, onUpdate)

    const textarea = card.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'Updated content'
    textarea.dispatchEvent(new Event('input'))

    expect(onUpdate).toHaveBeenCalledWith(2, 'Updated content')
  })

  it('renders the section title', () => {
    const section = makeSection({ title: 'My Custom Title' })
    const card = renderSectionCard(section, 0, vi.fn())
    const title = card.querySelector('.section-card-title') as HTMLElement

    expect(title.textContent).toBe('My Custom Title')
  })
})
