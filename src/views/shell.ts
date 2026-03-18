import { getState, setState, subscribe } from '../store/state'
import { flushAll } from '../store/sync'
import type { PipelineStage } from '../models/project'

export function renderShell(container: HTMLElement): { sidebar: HTMLElement; content: HTMLElement } {
  // Clear container safely
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  // T059: Skip to content link for screen readers
  const skipLink = document.createElement('a')
  skipLink.className = 'skip-to-content'
  skipLink.href = '#main-content'
  skipLink.textContent = 'Skip to content'
  container.appendChild(skipLink)

  const shell = document.createElement('div')
  shell.className = 'app-shell'

  const sidebar = document.createElement('aside')
  sidebar.className = 'sidebar'
  sidebar.setAttribute('role', 'navigation')
  sidebar.setAttribute('aria-label', 'Project navigation')
  sidebar.setAttribute('tabindex', '-1')

  const content = document.createElement('main')
  content.className = 'content-panel'
  content.setAttribute('role', 'main')
  content.id = 'main-content'

  // Mobile menu toggle (hamburger)
  const menuToggle = document.createElement('button')
  menuToggle.className = 'menu-toggle btn'
  menuToggle.setAttribute('aria-label', 'Toggle navigation menu')
  menuToggle.textContent = '\u2630'
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open')
    overlay.classList.toggle('visible')
  })

  const overlay = document.createElement('div')
  overlay.className = 'sidebar-overlay'
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open')
    overlay.classList.remove('visible')
  })

  // Toast container
  const toastContainer = document.createElement('div')
  toastContainer.className = 'toast-container'
  toastContainer.setAttribute('role', 'status')
  toastContainer.setAttribute('aria-live', 'polite')

  // T054: Mobile bottom navigation
  const mobileNav = document.createElement('nav')
  mobileNav.className = 'mobile-nav'
  mobileNav.setAttribute('aria-label', 'Pipeline stages')

  function renderMobileNav(): void {
    while (mobileNav.firstChild) mobileNav.removeChild(mobileNav.firstChild)

    const state = getState()
    // Show a subset of key stages for mobile
    const mobileStages: { stage: PipelineStage; label: string; icon: string }[] = [
      { stage: 'specify', label: 'Specify', icon: '\uD83D\uDCDD' },
      { stage: 'plan', label: 'Plan', icon: '\uD83D\uDCCB' },
      { stage: 'clarify', label: 'Clarify', icon: '\u2692' },
      { stage: 'tasks', label: 'Tasks', icon: '\u2713' },
    ]

    for (const { stage, label, icon } of mobileStages) {
      const btn = document.createElement('button')
      btn.className = 'mobile-nav-item'
      if (state.currentStage === stage) btn.classList.add('active')
      btn.setAttribute('aria-label', label)

      const iconSpan = document.createElement('span')
      iconSpan.textContent = icon
      iconSpan.setAttribute('aria-hidden', 'true')
      btn.appendChild(iconSpan)

      const labelSpan = document.createElement('span')
      labelSpan.textContent = label
      btn.appendChild(labelSpan)

      btn.addEventListener('click', () => {
        void flushAll().then(() => {
          setState({ currentStage: stage })
        })
      })

      mobileNav.appendChild(btn)
    }
  }

  renderMobileNav()
  subscribe(() => renderMobileNav())

  shell.appendChild(menuToggle)
  shell.appendChild(sidebar)
  shell.appendChild(content)
  container.appendChild(shell)
  container.appendChild(overlay)
  container.appendChild(mobileNav)
  container.appendChild(toastContainer)

  return { sidebar, content }
}
