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

  layout.appendChild(chatPanel)
  layout.appendChild(specPanel)
  container.appendChild(layout)

  renderChatPanel(chatPanel)
  renderCoverageBar(chatPanel)
  renderContentPanel(specPanel)
}
