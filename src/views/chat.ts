import { getState, setState, subscribe } from '../store/state'
import { markDirty, markConversationDirty } from '../store/sync'
import { sendMessage } from '../llm/client'
import { buildSystemPrompt } from '../llm/system-prompt'
import { createResponseParser } from '../llm/response-parser'
import { hasApiKey } from '../llm/config'
import { createConversation, createMessage } from '../models/conversation'
import type { SpecUpdate, Message } from '../models/conversation'
import { parseMarkdownSections, parseSectionsToMarkdown } from '../parsers/spec-parser'
import { markdownToHtml } from '../parsers/markdown-io'
import { scaffoldSpecFromIdea } from '../parsers/template'
import { createProject } from '../models/project'
import { createArtifact } from '../models/artifact'
import { createProjectInDB, createArtifactInDB, getConversationByProject, saveConversation } from '../store/db'
import { renderApiKeyModal } from './api-key-modal'

const WELCOME_MESSAGE = "Welcome to Spec Workbench! Tell me about what you want to build. Describe your idea in a few sentences and I'll help you develop it into a proper specification."

let messageList: HTMLElement | null = null
let typingIndicator: HTMLElement | null = null
let sendBtn: HTMLButtonElement | null = null
let textarea: HTMLTextAreaElement | null = null
let streamingBubble: HTMLElement | null = null
let streamingText = ''
let lastUserMessageContent = ''

export function renderChatPanel(container: HTMLElement): void {
  // Clear container safely
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  // Message list
  const messages = document.createElement('div')
  messages.className = 'chat-messages'
  messages.setAttribute('role', 'log')
  messages.setAttribute('aria-label', 'Chat messages')
  messageList = messages

  // Typing indicator (hidden by default)
  const typing = document.createElement('div')
  typing.className = 'typing-indicator'
  typing.style.display = 'none'
  typing.setAttribute('aria-label', 'Assistant is typing')
  for (let i = 0; i < 3; i++) {
    typing.appendChild(document.createElement('span'))
  }
  typingIndicator = typing

  // Input area
  const inputArea = document.createElement('div')
  inputArea.className = 'chat-input-area'

  const input = document.createElement('textarea')
  input.className = 'chat-input'
  input.placeholder = 'Describe your idea...'
  input.rows = 1
  input.setAttribute('aria-label', 'Chat message input')
  textarea = input

  const send = document.createElement('button')
  send.className = 'chat-send-btn'
  send.textContent = 'Send'
  send.setAttribute('aria-label', 'Send message')
  sendBtn = send

  inputArea.appendChild(input)
  inputArea.appendChild(send)

  container.appendChild(messages)
  container.appendChild(inputArea)

  // Auto-grow textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto'
    const maxHeight = 144 // 6 lines approx
    input.style.height = Math.min(input.scrollHeight, maxHeight) + 'px'
  })

  // Enter to send, Shift+Enter for newline
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  })

  send.addEventListener('click', () => {
    handleSend()
  })

  // Initialize: restore conversation or show welcome
  void initChat()

  // Subscribe for section focus changes
  let lastFocusSection: string | null = null
  subscribe((state) => {
    if (state.focusSection !== lastFocusSection) {
      const prevFocus = lastFocusSection
      lastFocusSection = state.focusSection
      if (state.focusSection && state.focusSection !== prevFocus) {
        appendFocusIndicator(state.focusSection)
      }
    }
  })
}

async function initChat(): Promise<void> {
  const state = getState()

  if (state.currentProjectId && !state.conversation) {
    // T022: Try to restore conversation from DB
    const existing = await getConversationByProject(state.currentProjectId)
    if (existing) {
      setState({ conversation: existing })
      // Render existing messages
      for (const msg of existing.messages) {
        renderMessageBubble(msg)
      }
      scrollToBottom()
      return
    }
  }

  if (!state.conversation) {
    // T020: Show welcome message (no project yet or new conversation)
    const welcomeBubble = createAssistantBubble()
    // Safe: markdownToHtml sanitizes through DOMPurify
    const sanitizedHtml = markdownToHtml(WELCOME_MESSAGE)
    const wrapper = document.createElement('div')
    wrapper.insertAdjacentHTML('afterbegin', sanitizedHtml)
    welcomeBubble.appendChild(wrapper)
    messageList?.appendChild(welcomeBubble)
  }
}

function handleSend(): void {
  if (!textarea || !sendBtn) return
  const text = textarea.value.trim()
  if (!text) return

  const state = getState()
  if (state.chatStatus === 'awaiting-response') return

  // Check API key
  if (!hasApiKey()) {
    const app = document.getElementById('app')
    if (app) {
      renderApiKeyModal(app, () => {
        // Retry send after key is set
        handleSend()
      })
    }
    return
  }

  lastUserMessageContent = text
  textarea.value = ''
  textarea.style.height = 'auto'

  // T020: If no project, create one from the idea
  if (!state.currentProjectId) {
    void createProjectFromIdea(text)
  } else {
    void sendUserMessage(text)
  }
}

async function createProjectFromIdea(idea: string): Promise<void> {
  // Create project
  const projectName = idea.slice(0, 40).replace(/\n/g, ' ')
  const project = createProject(projectName)
  await createProjectInDB(project)

  // Scaffold spec from idea
  const specContent = scaffoldSpecFromIdea(idea)
  const artifact = createArtifact(project.id, 'spec', 'specify', specContent)
  await createArtifactInDB(artifact)

  // Create conversation
  const conversation = createConversation(project.id)
  await saveConversation(conversation)

  // Update state
  const state = getState()
  const artifacts = new Map(state.artifacts)
  artifacts.set(artifact.id, artifact)

  setState({
    projects: [...state.projects, project],
    artifacts,
    currentProjectId: project.id,
    currentStage: 'specify',
    currentArtifactId: artifact.id,
    conversation,
  })

  // Now send the user message
  await sendUserMessage(idea)
}

async function sendUserMessage(text: string): Promise<void> {
  const state = getState()

  // Ensure conversation exists
  let conversation = state.conversation
  if (!conversation && state.currentProjectId) {
    conversation = createConversation(state.currentProjectId)
    setState({ conversation })
  }
  if (!conversation) return

  // Create user message
  const userMsg = createMessage('user', text)
  conversation.messages.push(userMsg)
  renderMessageBubble(userMsg)
  markConversationDirty()

  // Set status
  setState({ chatStatus: 'awaiting-response' })
  if (sendBtn) sendBtn.disabled = true
  if (typingIndicator) typingIndicator.style.display = 'flex'
  messageList?.appendChild(typingIndicator!)
  scrollToBottom()

  // Build system prompt
  const specArtifact = getSpecArtifact()
  const specContent = specArtifact?.content || ''
  const focusSection = state.focusSection
  const pipelineStage = conversation.pipelineStage || 'specify'

  // Extract glossary terms
  const glossaryTerms = extractGlossaryTerms(specContent)

  const systemPrompt = buildSystemPrompt(specContent, focusSection, pipelineStage, glossaryTerms)

  // Build API messages
  const apiMessages = conversation.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Setup streaming
  streamingText = ''
  streamingBubble = null
  const collectedUpdates: SpecUpdate[] = []

  const parser = createResponseParser({
    onText: (token: string) => {
      if (!streamingBubble) {
        streamingBubble = createAssistantBubble()
        // Hide typing indicator before showing bubble
        if (typingIndicator) typingIndicator.style.display = 'none'
        messageList?.appendChild(streamingBubble)
      }
      streamingText += token
      // Safe: markdownToHtml sanitizes output through DOMPurify
      const sanitizedHtml = markdownToHtml(streamingText)
      // Clear and re-render to avoid accumulation issues
      while (streamingBubble.firstChild) {
        streamingBubble.removeChild(streamingBubble.firstChild)
      }
      const wrapper = document.createElement('div')
      wrapper.insertAdjacentHTML('afterbegin', sanitizedHtml)
      streamingBubble.appendChild(wrapper)
      scrollToBottom()
    },
    onSpecUpdate: (update: SpecUpdate) => {
      collectedUpdates.push(update)
      applySpecUpdate(update)
      // Show inline indicator in chat
      appendUpdateIndicator(update.section)
    },
  })

  await sendMessage(
    apiMessages,
    systemPrompt,
    // onToken
    (token: string) => {
      parser.feed(token)
    },
    // onComplete
    (_fullResponse: string) => {
      parser.flush()

      // Create assistant message with collected updates
      const assistantMsg = createMessage('assistant', streamingText, collectedUpdates)
      conversation!.messages.push(assistantMsg)

      // Save conversation
      markConversationDirty()

      // Reset status
      setState({ chatStatus: 'idle', chatError: null })
      if (sendBtn) sendBtn.disabled = false
      if (typingIndicator) typingIndicator.style.display = 'none'
      streamingBubble = null
      streamingText = ''
      scrollToBottom()
    },
    // onError
    (error: Error) => {
      parser.flush()

      setState({ chatStatus: 'error', chatError: error.message })
      if (sendBtn) sendBtn.disabled = false
      if (typingIndicator) typingIndicator.style.display = 'none'

      // T021: Show error in chat
      appendErrorMessage(error.message)
      streamingBubble = null
      streamingText = ''
      scrollToBottom()
    },
  )
}

// --- T016: Spec update application ---

function applySpecUpdate(update: SpecUpdate): void {
  const specArtifact = getSpecArtifact()
  if (!specArtifact) return

  const sections = parseMarkdownSections(specArtifact.content)

  // Fuzzy match: check if update.section is contained in any section title
  const matchIndex = sections.findIndex(s =>
    s.title.toLowerCase().includes(update.section.toLowerCase()) ||
    update.section.toLowerCase().includes(s.title.toLowerCase())
  )

  if (update.action === 'replace' && matchIndex !== -1) {
    sections[matchIndex].content = update.content
  } else if (update.action === 'append' && matchIndex !== -1) {
    sections[matchIndex].content = sections[matchIndex].content
      ? sections[matchIndex].content + '\n\n' + update.content
      : update.content
  } else if (update.action === 'create' || matchIndex === -1) {
    // Create new section
    sections.push({
      headingLevel: 2,
      title: update.section,
      content: update.content,
      structuredData: null,
      collapsed: true,
    })
  }

  // Re-serialize
  const newContent = parseSectionsToMarkdown(sections)
  specArtifact.content = newContent
  specArtifact.updatedAt = new Date().toISOString()

  // Update in state
  const state = getState()
  const artifacts = new Map(state.artifacts)
  artifacts.set(specArtifact.id, specArtifact)
  setState({ artifacts })

  // Mark dirty for auto-save
  markDirty(specArtifact.id)

  // T017: Trigger highlight on the updated section card
  highlightSection(update.section)
}

// --- T017: Section highlight on LLM update ---

function highlightSection(sectionTitle: string): void {
  // Find the section card by title in the spec panel
  const cards = document.querySelectorAll('.section-card')
  for (const card of cards) {
    const titleEl = card.querySelector('.section-card-title')
    if (titleEl && titleEl.textContent?.toLowerCase().includes(sectionTitle.toLowerCase())) {
      card.classList.add('section-card--highlight')
      setTimeout(() => {
        card.classList.remove('section-card--highlight')
      }, 300)
      break
    }
  }
}

// --- T018: Section click-to-focus (called from content panel) ---

export function handleSectionFocus(sectionTitle: string): void {
  const state = getState()
  if (state.focusSection === sectionTitle) {
    // Unfocus
    setState({ focusSection: null })
  } else {
    setState({ focusSection: sectionTitle })
  }
}

// --- Helper: render a message bubble ---

function renderMessageBubble(msg: Message): void {
  if (!messageList) return

  if (msg.role === 'user') {
    const bubble = document.createElement('div')
    bubble.className = 'message-bubble message-bubble--user'
    bubble.textContent = msg.content
    messageList.appendChild(bubble)
  } else {
    const bubble = createAssistantBubble()
    // Safe: markdownToHtml sanitizes through DOMPurify
    const sanitizedHtml = markdownToHtml(msg.content)
    const wrapper = document.createElement('div')
    wrapper.insertAdjacentHTML('afterbegin', sanitizedHtml)
    bubble.appendChild(wrapper)
    messageList.appendChild(bubble)

    // Show spec update indicators for restored messages
    if (msg.specUpdates && msg.specUpdates.length > 0) {
      for (const update of msg.specUpdates) {
        const indicator = document.createElement('div')
        indicator.className = 'spec-update-indicator'
        indicator.style.fontSize = 'var(--text-xs)'
        indicator.style.color = 'var(--color-text-secondary)'
        indicator.style.marginTop = 'var(--space-1)'
        indicator.style.fontStyle = 'italic'
        indicator.textContent = `Updated: ${update.section}`
        messageList.appendChild(indicator)
      }
    }
  }
}

function createAssistantBubble(): HTMLElement {
  const bubble = document.createElement('div')
  bubble.className = 'message-bubble message-bubble--assistant'
  return bubble
}

// --- T015: Inline update indicator ---

function appendUpdateIndicator(sectionName: string): void {
  if (!messageList) return
  const indicator = document.createElement('div')
  indicator.className = 'spec-update-indicator'
  indicator.style.fontSize = 'var(--text-xs)'
  indicator.style.color = 'var(--color-text-secondary)'
  indicator.style.marginTop = 'var(--space-1)'
  indicator.style.fontStyle = 'italic'
  indicator.style.alignSelf = 'flex-start'
  indicator.textContent = `Updated: ${sectionName}`
  messageList.appendChild(indicator)
  scrollToBottom()
}

// --- T018: Focus indicator in chat ---

function appendFocusIndicator(sectionName: string): void {
  if (!messageList) return
  const indicator = document.createElement('div')
  indicator.style.fontSize = 'var(--text-xs)'
  indicator.style.color = 'var(--color-accent)'
  indicator.style.marginTop = 'var(--space-1)'
  indicator.style.fontStyle = 'italic'
  indicator.style.alignSelf = 'center'
  indicator.textContent = `Focus: ${sectionName}`
  messageList.appendChild(indicator)
  scrollToBottom()
}

// --- T021: Error message with retry ---

function appendErrorMessage(errorText: string): void {
  if (!messageList) return

  const errorDiv = document.createElement('div')
  errorDiv.className = 'message-bubble message-bubble--assistant'
  errorDiv.style.borderColor = 'var(--color-error)'
  errorDiv.style.color = 'var(--color-error)'

  const msg = document.createElement('p')
  msg.textContent = `Error: ${errorText}`
  errorDiv.appendChild(msg)

  const hint = document.createElement('p')
  hint.style.fontSize = 'var(--text-xs)'
  hint.style.marginTop = 'var(--space-1)'
  hint.textContent = 'Check your API key and network connection.'
  errorDiv.appendChild(hint)

  const retryBtn = document.createElement('button')
  retryBtn.className = 'btn btn--primary'
  retryBtn.style.marginTop = 'var(--space-2)'
  retryBtn.textContent = 'Retry'
  retryBtn.addEventListener('click', () => {
    errorDiv.remove()
    if (lastUserMessageContent) {
      // Remove the last user message from conversation (it will be re-sent)
      const state = getState()
      if (state.conversation && state.conversation.messages.length > 0) {
        const lastMsg = state.conversation.messages[state.conversation.messages.length - 1]
        if (lastMsg.role === 'user') {
          state.conversation.messages.pop()
        }
      }
      void sendUserMessage(lastUserMessageContent)
    }
  })
  errorDiv.appendChild(retryBtn)

  messageList.appendChild(errorDiv)
}

// --- Helpers ---

function scrollToBottom(): void {
  if (messageList) {
    messageList.scrollTop = messageList.scrollHeight
  }
}

function getSpecArtifact() {
  const state = getState()
  if (!state.currentProjectId) return null
  return [...state.artifacts.values()].find(
    a => a.projectId === state.currentProjectId && a.type === 'spec'
  ) || null
}

function extractGlossaryTerms(specContent: string): string[] {
  const terms: string[] = []
  const sections = parseMarkdownSections(specContent)
  const glossary = sections.find(s => s.title.toLowerCase().includes('glossary'))
  if (!glossary) return terms

  // Parse table rows: | Term | Definition | ...
  const lines = glossary.content.split('\n')
  for (const line of lines) {
    const match = line.match(/^\|\s*\*?\*?([^|*]+)\*?\*?\s*\|/)
    if (match) {
      const term = match[1].trim()
      if (term && term !== 'Term' && !term.startsWith('---')) {
        terms.push(term)
      }
    }
  }
  return terms
}
