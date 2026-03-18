import { describe, it, expect, beforeEach } from 'vitest'
import { getLLMConfig, saveLLMConfig, clearLLMConfig, hasApiKey } from '../../src/llm/config'

beforeEach(() => { localStorage.clear() })

describe('LLM Config', () => {
  it('returns defaults when no config stored', () => {
    const config = getLLMConfig()
    expect(config.apiKey).toBe('')
    expect(config.model).toBe('claude-sonnet-4-6')
  })

  it('round-trips config', () => {
    saveLLMConfig({ apiKey: 'sk-test', model: 'claude-sonnet-4-6', temperature: 0.5, maxTokens: 2048 })
    const config = getLLMConfig()
    expect(config.apiKey).toBe('sk-test')
    expect(config.temperature).toBe(0.5)
  })

  it('clears config', () => {
    saveLLMConfig({ apiKey: 'sk-test', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 4096 })
    clearLLMConfig()
    expect(hasApiKey()).toBe(false)
  })

  it('returns defaults on corrupt data', () => {
    localStorage.setItem('spec-workbench-llm-config', '{broken')
    const config = getLLMConfig()
    expect(config.model).toBe('claude-sonnet-4-6')
  })

  it('hasApiKey returns true when key set', () => {
    saveLLMConfig({ apiKey: 'sk-test', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 4096 })
    expect(hasApiKey()).toBe(true)
  })
})
