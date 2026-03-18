import { getState, setState, subscribe } from '../store/state'
import { markDirty, markConversationDirty } from '../store/sync'
import { sendMessage, abortStream } from '../llm/client'
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
import { deriveFeatureName, gatherAllGlossaryTerms, findCrossFeatureEntities } from './feature-tabs'

const WELCOME_MESSAGE = "Hey there! I'm your specification assistant. Tell me about the product or feature you'd like to build, and I'll help you shape it into a clear, detailed spec. Just describe your idea in a few sentences to get started."

let messageList: HTMLElement | null = null
let typingIndicator: HTMLElement | null = null
let sendBtn: HTMLButtonElement | null = null
let textarea: HTMLTextAreaElement | null = null
let streamingBubble: HTMLElement | null = null
let streamingText = ''
let lastUserMessageContent = ''
/** T039: Track whether user is scrolled to bottom */
let userAtBottom = true
/** T039: Scroll-to-bottom button */
let scrollBottomBtn: HTMLElement | null = null
/** T040: Aria-live region for screen reader announcements */
let ariaLiveRegion: HTMLElement | null = null

export function renderChatPanel(container: HTMLElement): void {
  // Clear container safely
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  // T040: Aria-live region for accessibility announcements
  const liveRegion = document.createElement('div')
  liveRegion.setAttribute('role', 'status')
  liveRegion.setAttribute('aria-live', 'polite')
  liveRegion.className = 'sr-only'
  liveRegion.style.position = 'absolute'
  liveRegion.style.width = '1px'
  liveRegion.style.height = '1px'
  liveRegion.style.overflow = 'hidden'
  liveRegion.style.clip = 'rect(0,0,0,0)'
  ariaLiveRegion = liveRegion
  container.appendChild(liveRegion)

  // Message list
  const messages = document.createElement('div')
  messages.className = 'chat-messages'
  messages.setAttribute('role', 'log')
  messages.setAttribute('aria-label', 'Chat messages')
  messages.setAttribute('aria-live', 'polite')
  messageList = messages

  // T039: Track scroll position
  messages.addEventListener('scroll', () => {
    const threshold = 50
    userAtBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < threshold
    if (scrollBottomBtn) {
      scrollBottomBtn.style.display = userAtBottom ? 'none' : 'block'
    }
  })

  // Typing indicator (hidden by default)
  const typing = document.createElement('div')
  typing.className = 'typing-indicator'
  typing.style.display = 'none'
  typing.setAttribute('aria-label', 'Assistant is typing')
  for (let i = 0; i < 3; i++) {
    typing.appendChild(document.createElement('span'))
  }
  typingIndicator = typing

  // T039: Scroll-to-bottom button
  const scrollBtn = document.createElement('button')
  scrollBtn.className = 'chat-scroll-bottom-btn'
  scrollBtn.textContent = '\u2193'
  scrollBtn.title = 'Jump to bottom'
  scrollBtn.setAttribute('aria-label', 'Jump to latest messages')
  scrollBtn.style.display = 'none'
  scrollBtn.style.position = 'absolute'
  scrollBtn.style.bottom = '70px'
  scrollBtn.style.right = 'var(--space-4)'
  scrollBtn.style.zIndex = '10'
  scrollBtn.style.width = '32px'
  scrollBtn.style.height = '32px'
  scrollBtn.style.borderRadius = '50%'
  scrollBtn.style.border = '1px solid var(--color-border)'
  scrollBtn.style.background = 'var(--color-surface)'
  scrollBtn.style.cursor = 'pointer'
  scrollBtn.style.fontSize = 'var(--text-lg)'
  scrollBtn.style.color = 'var(--color-text)'
  scrollBtn.addEventListener('click', () => {
    scrollToBottom()
  })
  scrollBottomBtn = scrollBtn

  // Input area
  const inputArea = document.createElement('div')
  inputArea.className = 'chat-input-area'

  const input = document.createElement('textarea')
  input.className = 'chat-input'
  input.placeholder = 'Describe your idea...'
  input.rows = 3
  input.setAttribute('aria-label', 'Chat message input')
  textarea = input

  const send = document.createElement('button')
  send.className = 'chat-send-btn'
  send.textContent = 'Send'
  send.setAttribute('aria-label', 'Send message')
  sendBtn = send

  const inputWrapper = document.createElement('div')
  inputWrapper.style.flex = '1'
  inputWrapper.style.display = 'flex'
  inputWrapper.style.flexDirection = 'column'
  inputWrapper.style.gap = 'var(--space-1)'
  inputWrapper.appendChild(input)

  const hint = document.createElement('div')
  hint.style.fontSize = 'var(--text-xs)'
  hint.style.color = 'var(--color-text-secondary)'
  hint.style.opacity = '0.7'
  hint.textContent = 'Press Enter to send, Shift+Enter for new line'
  inputWrapper.appendChild(hint)

  inputArea.appendChild(inputWrapper)
  inputArea.appendChild(send)

  // Need relative positioning for scroll button
  const messagesWrapper = document.createElement('div')
  messagesWrapper.style.position = 'relative'
  messagesWrapper.style.flex = '1'
  messagesWrapper.style.overflow = 'hidden'
  messagesWrapper.style.display = 'flex'
  messagesWrapper.style.flexDirection = 'column'
  messagesWrapper.appendChild(messages)
  messagesWrapper.appendChild(scrollBtn)

  container.appendChild(messagesWrapper)
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

  // T038: Escape to cancel streaming
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const state = getState()
      if (state.chatStatus === 'awaiting-response') {
        e.preventDefault()
        abortStream()
        setState({ chatStatus: 'idle' })
        if (sendBtn) sendBtn.disabled = false
        if (typingIndicator) typingIndicator.style.display = 'none'
        // Keep partial response
        if (streamingBubble && streamingText) {
          finalizeStreamingMessage()
        }
        announce('Streaming cancelled')
      }
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

  // T040: Focus returns to input after sending
  textarea.focus()
  announce('Message sent')
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

  // Build system prompt with enhanced context
  const specArtifact = getSpecArtifact()
  const specContent = specArtifact?.content || ''
  const focusSection = state.focusSection
  const pipelineStage = conversation.pipelineStage || 'specify'

  // T025: Gather glossary terms from ALL features
  const glossaryTerms = state.currentProjectId
    ? gatherAllGlossaryTerms(state.currentProjectId, state.artifacts)
    : extractGlossaryTerms(specContent)

  // T024: Build summaries of other features
  const otherFeatureSummaries = buildOtherFeatureSummaries()

  // T025: Cross-feature entity names
  const crossFeatureEntityNames = buildCrossFeatureEntityList()

  // T029: Compute coverage for safety-net
  const { coveragePercent, uncoveredSections } = computeCoverage(specContent)

  const systemPrompt = buildSystemPrompt(specContent, focusSection, pipelineStage, glossaryTerms, {
    otherFeatureSummaries,
    crossFeatureEntities: crossFeatureEntityNames,
    coveragePercent,
    uncoveredSections,
    safetyNetFired: conversation.safetyNetFired || false,
  })

  // T042: Trim conversation for API (context window management)
  const apiMessages = trimConversationForAPI(conversation.messages)

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
      if (userAtBottom) scrollToBottom()
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

      // T029: Check if safety-net should fire
      if (coveragePercent >= 80 && !conversation!.safetyNetFired) {
        conversation!.safetyNetFired = true
        markConversationDirty()
      }

      // Reset status
      setState({ chatStatus: 'idle', chatError: null })
      if (sendBtn) sendBtn.disabled = false
      if (typingIndicator) typingIndicator.style.display = 'none'
      streamingBubble = null
      streamingText = ''
      if (userAtBottom) scrollToBottom()
      announce('Response received')
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

/** Finalize a partial streaming message (e.g., after Escape cancellation) */
function finalizeStreamingMessage(): void {
  const state = getState()
  const conversation = state.conversation
  if (!conversation) return

  const assistantMsg = createMessage('assistant', streamingText, [])
  conversation.messages.push(assistantMsg)
  markConversationDirty()
  streamingBubble = null
  streamingText = ''
}

// --- T016: Spec update application ---

function applySpecUpdate(update: SpecUpdate): void {
  const state = getState()
  const pipelineStage = state.conversation?.pipelineStage || state.currentStage

  // T035: Route to correct artifact based on current stage
  const artifact = pipelineStage === 'plan' ? getPlanArtifact() : getSpecArtifact()
  if (!artifact) return

  const sections = parseMarkdownSections(artifact.content)

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
  artifact.content = newContent
  artifact.updatedAt = new Date().toISOString()

  // Update in state
  const artifacts = new Map(state.artifacts)
  artifacts.set(artifact.id, artifact)
  setState({ artifacts })

  // Mark dirty for auto-save
  markDirty(artifact.id)

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
  if (userAtBottom) scrollToBottom()
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
  if (userAtBottom) scrollToBottom()
  // T040: Announce focus change
  announce(`Now discussing ${sectionName}`)
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

// --- T033: Pipeline stage transition ---

export function transitionToStage(stage: import('../models/project').PipelineStage): void {
  const state = getState()
  if (!state.conversation) return

  // Update conversation pipeline stage
  state.conversation.pipelineStage = stage
  markConversationDirty()

  // Update project current stage
  setState({ currentStage: stage })

  // Find or set the appropriate artifact for the new stage
  if (state.currentProjectId) {
    const stageArtifacts = [...state.artifacts.values()].filter(
      a => a.projectId === state.currentProjectId && a.stage === stage
    )
    if (stageArtifacts.length > 0) {
      setState({ currentArtifactId: stageArtifacts[0].id })
    }
  }

  // Add a visual separator
  if (messageList) {
    const separator = document.createElement('div')
    separator.style.fontSize = 'var(--text-xs)'
    separator.style.color = 'var(--color-accent)'
    separator.style.textAlign = 'center'
    separator.style.padding = 'var(--space-2) 0'
    separator.style.borderTop = '1px dashed var(--color-border)'
    separator.style.borderBottom = '1px dashed var(--color-border)'
    separator.style.margin = 'var(--space-2) 0'
    separator.textContent = `Transitioned to: ${stage.charAt(0).toUpperCase() + stage.slice(1)} stage`
    messageList.appendChild(separator)
    scrollToBottom()
  }
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

  // If current artifact is a spec, use it
  if (state.currentArtifactId) {
    const current = state.artifacts.get(state.currentArtifactId)
    if (current && current.type === 'spec') return current
  }

  return [...state.artifacts.values()].find(
    a => a.projectId === state.currentProjectId && a.type === 'spec'
  ) || null
}

/** T035: Get plan artifact for plan-stage updates */
function getPlanArtifact() {
  const state = getState()
  if (!state.currentProjectId) return null
  return [...state.artifacts.values()].find(
    a => a.projectId === state.currentProjectId && a.type === 'plan'
  ) || null
}

function extractGlossaryTerms(specContent: string): string[] {
  const terms: string[] = []
  const sections = parseMarkdownSections(specContent)
  const glossary = sections.find(s => s.title.toLowerCase().includes('glossary'))
  if (!glossary) return terms

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

/** T024: Build summaries of other features for multi-feature context */
function buildOtherFeatureSummaries(): string[] {
  const state = getState()
  if (!state.currentProjectId) return []

  const summaries: string[] = []
  const specArtifacts = [...state.artifacts.values()].filter(
    a => a.projectId === state.currentProjectId && a.type === 'spec' && a.id !== state.currentArtifactId
  )

  for (const artifact of specArtifacts) {
    const name = deriveFeatureName(artifact.content)
    const sections = parseMarkdownSections(artifact.content)
    const filled = sections.filter(s => s.content.trim().length > 20).length
    summaries.push(`${name} (${filled}/${sections.length} sections filled)`)
  }

  return summaries
}

/** T025: Build list of entity names from other features */
function buildCrossFeatureEntityList(): string[] {
  const state = getState()
  if (!state.currentProjectId) return []

  const entityMap = findCrossFeatureEntities(state.currentProjectId, state.artifacts)
  // Only include entities that appear in more than one feature
  const shared: string[] = []
  for (const [name, features] of entityMap) {
    if (features.length > 1) {
      shared.push(name)
    }
  }
  return shared
}

/** T029: Compute coverage percentage and uncovered section names */
function computeCoverage(specContent: string): { coveragePercent: number; uncoveredSections: string[] } {
  if (!specContent) return { coveragePercent: 0, uncoveredSections: [] }

  const sections = parseMarkdownSections(specContent)
  const total = sections.length
  if (total === 0) return { coveragePercent: 0, uncoveredSections: [] }

  const filled = sections.filter(s => s.content.trim().length > 20)
  const uncovered = sections.filter(s => s.content.trim().length <= 20).map(s => s.title)
  const percent = Math.round((filled.length / total) * 100)

  return { coveragePercent: percent, uncoveredSections: uncovered }
}

/**
 * T041/T042: Trim conversation for API to manage context window.
 * If conversation has >50 messages, summarize older messages into a context block.
 * Send summary + last 20 messages.
 */
export function trimConversationForAPI(
  messages: Message[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const MAX_MESSAGES = 50
  const KEEP_RECENT = 20

  const apiMessages = messages
    .filter(m => !m.content.startsWith('---')) // Filter out separator messages
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  if (apiMessages.length <= MAX_MESSAGES) {
    return apiMessages
  }

  // Summarize older messages
  const older = apiMessages.slice(0, apiMessages.length - KEEP_RECENT)
  const recent = apiMessages.slice(apiMessages.length - KEEP_RECENT)

  // Build a condensed summary of older messages
  const summaryParts: string[] = []
  for (const msg of older) {
    if (msg.role === 'user') {
      // Keep user topics, abbreviated
      const abbreviated = msg.content.slice(0, 100)
      summaryParts.push(`User discussed: ${abbreviated}`)
    }
  }
  const summaryText = `[Conversation summary - ${older.length} earlier messages]\n${summaryParts.join('\n')}`

  return [
    { role: 'user', content: summaryText },
    { role: 'assistant', content: 'I understand the context from our earlier discussion. Let me continue helping you.' },
    ...recent,
  ]
}

/** T040: Announce to screen readers via aria-live region */
function announce(text: string): void {
  if (ariaLiveRegion) {
    ariaLiveRegion.textContent = text
    // Clear after announcement to allow re-announcing same text
    setTimeout(() => {
      if (ariaLiveRegion) ariaLiveRegion.textContent = ''
    }, 1000)
  }
}
