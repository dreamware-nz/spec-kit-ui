import { saveLLMConfig, getLLMConfig } from '../llm/config'
import { validateApiKey } from '../llm/client'

export function renderApiKeyModal(
  container: HTMLElement,
  onComplete: () => void,
): void {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-labelledby', 'api-key-title')
  overlay.setAttribute('aria-modal', 'true')

  const card = document.createElement('div')
  card.className = 'modal-card'

  const title = document.createElement('h2')
  title.id = 'api-key-title'
  title.textContent = 'Welcome to Spec Workbench'

  const desc = document.createElement('p')
  desc.textContent = "To get started, I'll need your Claude API key. It's stored locally in your browser and only sent to the Claude API."

  const inputGroup = document.createElement('div')
  inputGroup.className = 'input-group'

  const input = document.createElement('input')
  input.className = 'input'
  input.type = 'password'
  input.id = 'api-key-input'
  input.placeholder = 'sk-ant-...'
  input.setAttribute('aria-label', 'Claude API key')

  const toggleBtn = document.createElement('button')
  toggleBtn.className = 'btn'
  toggleBtn.id = 'toggle-visibility'
  toggleBtn.setAttribute('aria-label', 'Toggle key visibility')
  toggleBtn.textContent = 'Show'

  inputGroup.appendChild(input)
  inputGroup.appendChild(toggleBtn)

  const errorDiv = document.createElement('div')
  errorDiv.className = 'modal-error'
  errorDiv.id = 'api-key-error'
  errorDiv.style.display = 'none'

  const saveBtn = document.createElement('button')
  saveBtn.className = 'btn btn--primary'
  saveBtn.id = 'save-api-key'
  saveBtn.style.width = '100%'
  saveBtn.textContent = 'Connect'

  card.appendChild(title)
  card.appendChild(desc)
  card.appendChild(inputGroup)
  card.appendChild(errorDiv)
  card.appendChild(saveBtn)
  overlay.appendChild(card)
  container.appendChild(overlay)

  input.focus()

  toggleBtn.addEventListener('click', () => {
    if (input.type === 'password') {
      input.type = 'text'
      toggleBtn.textContent = 'Hide'
    } else {
      input.type = 'password'
      toggleBtn.textContent = 'Show'
    }
  })

  saveBtn.addEventListener('click', async () => {
    const key = input.value.trim()
    if (!key) {
      errorDiv.textContent = 'Please enter your API key.'
      errorDiv.style.display = 'block'
      return
    }

    saveBtn.disabled = true
    saveBtn.textContent = 'Validating...'
    errorDiv.style.display = 'none'

    try {
      const valid = await validateApiKey(key)
      if (valid) {
        const config = getLLMConfig()
        config.apiKey = key
        saveLLMConfig(config)
        overlay.remove()
        onComplete()
      } else {
        errorDiv.textContent = 'Invalid API key. Please check and try again.'
        errorDiv.style.display = 'block'
      }
    } catch (err) {
      errorDiv.textContent = `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      errorDiv.style.display = 'block'
    } finally {
      saveBtn.disabled = false
      saveBtn.textContent = 'Connect'
    }
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click()
  })
}
