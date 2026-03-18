export interface SpecUpdate {
  section: string
  content: string
  action: 'replace' | 'append' | 'create'
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  specUpdates: SpecUpdate[]
  timestamp: string
}

export interface Conversation {
  id: string
  projectId: string
  messages: Message[]
  currentFocusSection: string | null
  pipelineStage: string
  /** T029: Track whether safety-net prompt has fired for this conversation */
  safetyNetFired?: boolean
  createdAt: string
  updatedAt: string
}

export interface LLMConfig {
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  apiKey: '',
  model: 'claude-sonnet-4-5-20250514',
  temperature: 0.7,
  maxTokens: 4096,
}

export function createConversation(projectId: string): Conversation {
  return {
    id: crypto.randomUUID(),
    projectId,
    messages: [],
    currentFocusSection: null,
    pipelineStage: 'specify',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function createMessage(role: 'user' | 'assistant', content: string, specUpdates: SpecUpdate[] = []): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    specUpdates,
    timestamp: new Date().toISOString(),
  }
}
