import { getState, setState, addToast } from '../store/state'
import { flushAll } from '../store/sync'
import { PIPELINE_STAGES } from '../models/pipeline'

let commandPaletteToggle: (() => void) | null = null

export function setCommandPaletteToggle(toggle: () => void): void {
  commandPaletteToggle = toggle
}

export function initKeyboardNav(): void {
  document.addEventListener('keydown', handleGlobalKeyboard)
}

function handleGlobalKeyboard(e: KeyboardEvent): void {
  const isMod = e.metaKey || e.ctrlKey

  // Ctrl/Cmd+K: toggle command palette
  if (isMod && e.key === 'k') {
    e.preventDefault()
    commandPaletteToggle?.()
    return
  }

  // Ctrl/Cmd+S: force-save
  if (isMod && e.key === 's') {
    e.preventDefault()
    void flushAll().then(() => {
      addToast('All changes saved', 'success')
    })
    return
  }

  // Escape: close expanded section cards, dismiss command palette
  if (e.key === 'Escape') {
    // Command palette handles its own Escape via its keydown
    // Close any expanded section cards
    const expanded = document.querySelectorAll('.section-card.expanded')
    if (expanded.length > 0) {
      for (const card of expanded) {
        const header = card.querySelector('.section-card-header') as HTMLElement
        header?.click()
      }
      e.preventDefault()
      return
    }
  }

  // Tab: navigate between sidebar and content panel
  if (e.key === 'Tab' && !isMod && !e.shiftKey) {
    const active = document.activeElement
    const sidebar = document.querySelector('.sidebar')
    const content = document.querySelector('.content-panel')

    if (sidebar && content) {
      if (sidebar.contains(active)) {
        // Move focus to first focusable in content
        const target = content.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (target) {
          e.preventDefault()
          target.focus()
        }
      }
    }
  }

  // Arrow keys for sidebar navigation (only when sidebar is focused)
  const sidebar = document.querySelector('.sidebar')
  if (sidebar?.contains(document.activeElement)) {
    const state = getState()
    const currentIndex = PIPELINE_STAGES.indexOf(state.currentStage)

    if (e.key === 'ArrowDown' && currentIndex < PIPELINE_STAGES.length - 1) {
      e.preventDefault()
      const nextStage = PIPELINE_STAGES[currentIndex + 1]
      void flushAll().then(() => {
        setState({ currentStage: nextStage })
        const nextBtn = sidebar.querySelector(`[data-stage="${nextStage}"]`) as HTMLElement
        nextBtn?.focus()
      })
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault()
      const prevStage = PIPELINE_STAGES[currentIndex - 1]
      void flushAll().then(() => {
        setState({ currentStage: prevStage })
        const prevBtn = sidebar.querySelector(`[data-stage="${prevStage}"]`) as HTMLElement
        prevBtn?.focus()
      })
    }
  }
}
