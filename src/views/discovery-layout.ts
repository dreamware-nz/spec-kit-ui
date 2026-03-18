import { renderChatPanel } from './chat'
import { renderContentPanel } from './content'
import { renderCoverageBar } from './coverage-bar'

export function renderDiscoveryLayout(container: HTMLElement): void {
  // Clear container safely
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  const layout = document.createElement('div')
  layout.className = 'discovery-layout'

  const chatPanel = document.createElement('div')
  chatPanel.className = 'chat-panel'

  const specPanel = document.createElement('div')
  specPanel.className = 'spec-panel-wrapper content-panel'

  // T037: Responsive tab switcher for tablet/mobile
  const tabSwitcher = document.createElement('div')
  tabSwitcher.className = 'discovery-tab-switcher'

  const chatTabBtn = document.createElement('button')
  chatTabBtn.className = 'discovery-tab-btn active'
  chatTabBtn.textContent = 'Chat'
  chatTabBtn.setAttribute('aria-label', 'Show chat panel')

  const specTabBtn = document.createElement('button')
  specTabBtn.className = 'discovery-tab-btn'
  specTabBtn.textContent = 'Spec'
  specTabBtn.setAttribute('aria-label', 'Show spec panel')

  chatTabBtn.addEventListener('click', () => {
    chatPanel.style.display = ''
    specPanel.classList.remove('visible')
    chatTabBtn.classList.add('active')
    specTabBtn.classList.remove('active')
  })

  specTabBtn.addEventListener('click', () => {
    chatPanel.style.display = 'none'
    specPanel.classList.add('visible')
    specTabBtn.classList.add('active')
    chatTabBtn.classList.remove('active')
  })

  tabSwitcher.appendChild(chatTabBtn)
  tabSwitcher.appendChild(specTabBtn)

  layout.appendChild(tabSwitcher)
  layout.appendChild(chatPanel)
  layout.appendChild(specPanel)
  container.appendChild(layout)

  renderChatPanel(chatPanel)
  renderCoverageBar(chatPanel)

  // Feature tabs removed — features are now in the sidebar
  renderContentPanel(specPanel)
}
