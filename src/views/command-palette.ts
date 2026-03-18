import { setState, addToast } from '../store/state'
import { flushAll } from '../store/sync'
import { setCommandPaletteToggle } from './keyboard'

interface Command {
  label: string
  action: () => void
}

let overlay: HTMLElement | null = null
let isOpen = false

export function initCommandPalette(): void {
  setCommandPaletteToggle(toggle)
}

function getCommands(): Command[] {
  return [
    {
      label: 'New Project',
      action: () => {
        // Navigate to empty state by clearing current project
        setState({ currentProjectId: null, currentArtifactId: null })
        addToast('Ready to create a new project', 'info')
      },
    },
    {
      label: 'Export Current',
      action: () => {
        const exportBtn = document.querySelector('.content-toolbar .btn') as HTMLElement
        exportBtn?.click()
      },
    },
    {
      label: 'Import File',
      action: () => {
        const buttons = document.querySelectorAll('.content-toolbar .btn')
        const importBtn = buttons[1] as HTMLElement
        importBtn?.click()
      },
    },
    {
      label: 'Go to Specify',
      action: () => {
        void flushAll().then(() => setState({ currentStage: 'specify' }))
      },
    },
    {
      label: 'Go to Plan',
      action: () => {
        void flushAll().then(() => setState({ currentStage: 'plan' }))
      },
    },
    {
      label: 'Go to Tasks',
      action: () => {
        void flushAll().then(() => setState({ currentStage: 'tasks' }))
      },
    },
    {
      label: 'Save All',
      action: () => {
        void flushAll().then(() => addToast('All changes saved', 'success'))
      },
    },
  ]
}

function toggle(): void {
  if (isOpen) {
    close()
  } else {
    open()
  }
}

function open(): void {
  if (isOpen) return
  isOpen = true

  overlay = document.createElement('div')
  overlay.className = 'command-palette-overlay'
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  const modal = document.createElement('div')
  modal.className = 'command-palette'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-label', 'Command palette')

  const input = document.createElement('input')
  input.className = 'command-palette-input'
  input.type = 'text'
  input.placeholder = 'Type a command...'
  input.setAttribute('aria-label', 'Search commands')
  modal.appendChild(input)

  const list = document.createElement('div')
  list.className = 'command-palette-list'
  list.setAttribute('role', 'listbox')
  modal.appendChild(list)

  const commands = getCommands()
  let selectedIndex = 0

  function renderList(filter: string): void {
    while (list.firstChild) list.removeChild(list.firstChild)

    const filtered = commands.filter(cmd =>
      cmd.label.toLowerCase().includes(filter.toLowerCase()),
    )

    if (filtered.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'command-palette-empty'
      empty.textContent = 'No matching commands'
      list.appendChild(empty)
      return
    }

    // Clamp selectedIndex
    if (selectedIndex >= filtered.length) selectedIndex = filtered.length - 1
    if (selectedIndex < 0) selectedIndex = 0

    for (let i = 0; i < filtered.length; i++) {
      const item = document.createElement('button')
      item.className = 'command-palette-item'
      if (i === selectedIndex) item.classList.add('selected')
      item.setAttribute('role', 'option')
      item.setAttribute('aria-selected', String(i === selectedIndex))
      item.textContent = filtered[i].label
      const idx = i
      item.addEventListener('click', () => {
        close()
        filtered[idx].action()
      })
      item.addEventListener('mouseenter', () => {
        selectedIndex = idx
        renderList(input.value)
      })
      list.appendChild(item)
    }
  }

  input.addEventListener('input', () => {
    selectedIndex = 0
    renderList(input.value)
  })

  input.addEventListener('keydown', (e) => {
    const filtered = commands.filter(cmd =>
      cmd.label.toLowerCase().includes(input.value.toLowerCase()),
    )

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1)
      renderList(input.value)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
      renderList(input.value)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        close()
        filtered[selectedIndex].action()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  })

  overlay.appendChild(modal)
  document.body.appendChild(overlay)
  renderList('')
  input.focus()
}

function close(): void {
  if (!isOpen || !overlay) return
  isOpen = false
  overlay.remove()
  overlay = null
}
