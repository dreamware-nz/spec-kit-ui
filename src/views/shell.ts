export function renderShell(container: HTMLElement): { sidebar: HTMLElement; content: HTMLElement } {
  // Clear container safely
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  const shell = document.createElement('div')
  shell.className = 'app-shell'

  const sidebar = document.createElement('aside')
  sidebar.className = 'sidebar'
  sidebar.setAttribute('role', 'navigation')
  sidebar.setAttribute('aria-label', 'Project navigation')

  const content = document.createElement('main')
  content.className = 'content-panel'
  content.setAttribute('role', 'main')

  // Mobile menu toggle
  const menuToggle = document.createElement('button')
  menuToggle.className = 'menu-toggle btn'
  menuToggle.setAttribute('aria-label', 'Toggle navigation')
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

  shell.appendChild(sidebar)
  shell.appendChild(content)
  container.appendChild(shell)
  container.appendChild(overlay)
  container.appendChild(toastContainer)

  return { sidebar, content }
}
