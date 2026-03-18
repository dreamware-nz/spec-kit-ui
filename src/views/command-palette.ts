import { getState, setState, addToast } from '../store/state'
import { flushAll } from '../store/sync'
import { setCommandPaletteToggle } from './keyboard'
import { clearLLMConfig } from '../llm/config'
import { renderApiKeyModal } from './api-key-modal'

interface Command {
  label: string
  shortcut?: string
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
    // T038: Focus section command
    {
      label: 'Focus Section...',
      shortcut: 'dblclick header',
      action: () => {
        // Toggle focus on the first unfocused section card
        const state = getState()
        if (state.focusSection) {
          setState({ focusSection: null })
          addToast('Section focus cleared', 'info')
        } else {
          addToast('Double-click a section header in the spec panel to focus on it', 'info')
        }
      },
    },
    // T038: Clear conversation command
    {
      label: 'Clear Conversation',
      action: () => {
        const state = getState()
        if (state.conversation) {
          state.conversation.messages = []
          setState({ conversation: state.conversation })
          addToast('Conversation cleared', 'info')
        }
      },
    },
    // T038: Change API key command
    {
      label: 'Change API Key',
      action: () => {
        clearLLMConfig()
        const app = document.getElementById('app')
        if (app) {
          renderApiKeyModal(app, () => {
            addToast('API key updated', 'success')
          })
        }
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
      shortcut: 'Ctrl+S',
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
      const labelSpan = document.createElement('span')
      labelSpan.style.flex = '1'
      labelSpan.textContent = filtered[i].label
      item.appendChild(labelSpan)
      if (filtered[i].shortcut) {
        const shortcutSpan = document.createElement('span')
        shortcutSpan.style.fontSize = 'var(--text-xs)'
        shortcutSpan.style.color = 'var(--color-text-secondary)'
        shortcutSpan.style.marginLeft = 'var(--space-2)'
        shortcutSpan.textContent = filtered[i].shortcut!
        item.appendChild(shortcutSpan)
      }
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
