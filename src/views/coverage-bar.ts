import { getState, subscribe } from '../store/state'
import { parseMarkdownSections } from '../parsers/spec-parser'

export function renderCoverageBar(container: HTMLElement): void {
  const bar = document.createElement('div')
  bar.className = 'coverage-bar'
  const fill = document.createElement('div')
  fill.className = 'coverage-bar-fill'
  bar.appendChild(fill)
  container.appendChild(bar)

  function update(): void {
    const state = getState()
    if (!state.currentProjectId) { fill.style.width = '0%'; return }

    // Find spec artifact
    const spec = [...state.artifacts.values()].find(
      a => a.projectId === state.currentProjectId && a.type === 'spec'
    )
    if (!spec || !spec.content) { fill.style.width = '0%'; return }

    const sections = parseMarkdownSections(spec.content)
    const totalSections = sections.length
    const filledSections = sections.filter(s => s.content.trim().length > 20).length
    const percent = totalSections > 0 ? Math.round((filledSections / totalSections) * 100) : 0
    fill.style.width = `${percent}%`
  }

  subscribe(update)
  update()
}
