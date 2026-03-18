import { getState, setState, subscribe } from '../store/state'
import { parseMarkdownSections } from '../parsers/spec-parser'

export function renderCoverageBar(container: HTMLElement): void {
  const wrapper = document.createElement('div')
  wrapper.className = 'coverage-bar-wrapper'
  wrapper.style.padding = '0 var(--space-4)'
  wrapper.style.position = 'relative'

  const labelRow = document.createElement('div')
  labelRow.style.display = 'flex'
  labelRow.style.justifyContent = 'space-between'
  labelRow.style.alignItems = 'center'
  labelRow.style.fontSize = 'var(--text-xs)'
  labelRow.style.color = 'var(--color-text-secondary)'
  labelRow.style.marginBottom = 'var(--space-1)'

  const percentLabel = document.createElement('span')
  percentLabel.className = 'coverage-percent-label'
  percentLabel.textContent = 'Coverage: 0%'
  labelRow.appendChild(percentLabel)

  // T032: "See gaps" link
  const gapsLink = document.createElement('button')
  gapsLink.className = 'coverage-gaps-link'
  gapsLink.textContent = 'See gaps'
  gapsLink.style.border = 'none'
  gapsLink.style.background = 'none'
  gapsLink.style.color = 'var(--color-accent)'
  gapsLink.style.cursor = 'pointer'
  gapsLink.style.fontSize = 'var(--text-xs)'
  gapsLink.style.textDecoration = 'underline'
  gapsLink.style.display = 'none'
  gapsLink.setAttribute('aria-label', 'Show uncovered spec sections')
  labelRow.appendChild(gapsLink)

  wrapper.appendChild(labelRow)

  // T040: Accessible progress bar
  const bar = document.createElement('div')
  bar.className = 'coverage-bar'
  bar.setAttribute('role', 'progressbar')
  bar.setAttribute('aria-valuemin', '0')
  bar.setAttribute('aria-valuemax', '100')
  bar.setAttribute('aria-valuenow', '0')
  bar.setAttribute('aria-valuetext', 'Coverage: 0%')

  const fill = document.createElement('div')
  fill.className = 'coverage-bar-fill'
  bar.appendChild(fill)
  wrapper.appendChild(bar)

  // T032: Gaps dropdown
  const gapsDropdown = document.createElement('div')
  gapsDropdown.className = 'coverage-gaps-dropdown'
  gapsDropdown.style.display = 'none'
  gapsDropdown.style.position = 'absolute'
  gapsDropdown.style.right = 'var(--space-4)'
  gapsDropdown.style.top = '100%'
  gapsDropdown.style.background = 'var(--color-surface)'
  gapsDropdown.style.border = '1px solid var(--color-border)'
  gapsDropdown.style.borderRadius = 'var(--radius-md)'
  gapsDropdown.style.padding = 'var(--space-2)'
  gapsDropdown.style.zIndex = '20'
  gapsDropdown.style.minWidth = '180px'
  gapsDropdown.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
  wrapper.appendChild(gapsDropdown)

  let gapsVisible = false
  gapsLink.addEventListener('click', () => {
    gapsVisible = !gapsVisible
    gapsDropdown.style.display = gapsVisible ? 'block' : 'none'
  })

  // Close gaps dropdown on outside click
  document.addEventListener('click', (e) => {
    if (gapsVisible && !wrapper.contains(e.target as Node)) {
      gapsVisible = false
      gapsDropdown.style.display = 'none'
    }
  })

  container.appendChild(wrapper)

  function update(): void {
    const state = getState()
    if (!state.currentProjectId) {
      fill.style.width = '0%'
      percentLabel.textContent = 'Coverage: 0%'
      gapsLink.style.display = 'none'
      return
    }

    // Find spec artifact (prefer current)
    let spec = state.currentArtifactId ? state.artifacts.get(state.currentArtifactId) : null
    if (!spec || spec.type !== 'spec') {
      spec = [...state.artifacts.values()].find(
        a => a.projectId === state.currentProjectId && a.type === 'spec'
      ) || null
    }
    if (!spec || !spec.content) {
      fill.style.width = '0%'
      percentLabel.textContent = 'Coverage: 0%'
      gapsLink.style.display = 'none'
      return
    }

    const sections = parseMarkdownSections(spec.content)
    const totalSections = sections.length
    const filledSections = sections.filter(s => s.content.trim().length > 20).length
    const percent = totalSections > 0 ? Math.round((filledSections / totalSections) * 100) : 0
    fill.style.width = `${percent}%`
    percentLabel.textContent = `Coverage: ${percent}%`

    // T040: Update ARIA attributes
    bar.setAttribute('aria-valuenow', String(percent))
    bar.setAttribute('aria-valuetext', `Coverage: ${percent}%`)

    // T032: Show/hide gaps link
    const uncovered = sections.filter(s => s.content.trim().length <= 20)
    if (uncovered.length > 0 && percent < 100) {
      gapsLink.style.display = ''

      // Update gaps dropdown content
      while (gapsDropdown.firstChild) {
        gapsDropdown.removeChild(gapsDropdown.firstChild)
      }

      const title = document.createElement('div')
      title.style.fontWeight = '600'
      title.style.fontSize = 'var(--text-xs)'
      title.style.marginBottom = 'var(--space-1)'
      title.textContent = 'Empty or minimal sections:'
      gapsDropdown.appendChild(title)

      for (const section of uncovered) {
        const item = document.createElement('button')
        item.style.display = 'block'
        item.style.width = '100%'
        item.style.textAlign = 'left'
        item.style.border = 'none'
        item.style.background = 'none'
        item.style.padding = 'var(--space-1) var(--space-2)'
        item.style.fontSize = 'var(--text-xs)'
        item.style.color = 'var(--color-text)'
        item.style.cursor = 'pointer'
        item.style.borderRadius = 'var(--radius-sm)'
        item.textContent = section.title
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--color-surface-hover)'
        })
        item.addEventListener('mouseleave', () => {
          item.style.background = 'none'
        })
        item.addEventListener('click', () => {
          // T032 + T018: Focus conversation on this section
          setState({ focusSection: section.title })
          gapsVisible = false
          gapsDropdown.style.display = 'none'
        })
        gapsDropdown.appendChild(item)
      }
    } else {
      gapsLink.style.display = 'none'
    }
  }

  subscribe(update)
  update()
}
