import { subscribe, getState } from '../store/state'

export function renderToasts(container: HTMLElement): void {
  function update(): void {
    // Clear existing toasts
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    const { toasts } = getState()
    for (const toast of toasts) {
      const el = document.createElement('div')
      el.className = `toast toast--${toast.type}`
      el.textContent = toast.message
      container.appendChild(el)
    }
  }

  subscribe(update)
  update()
}
