import type { LLMConfig } from '../models/conversation'
import { DEFAULT_LLM_CONFIG } from '../models/conversation'

const STORAGE_KEY = 'spec-workbench-llm-config'

export function getLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LLM_CONFIG }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_LLM_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_LLM_CONFIG }
  }
}

export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearLLMConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasApiKey(): boolean {
  const config = getLLMConfig()
  return config.apiKey.length > 0
}
