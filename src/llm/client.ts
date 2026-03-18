import Anthropic from '@anthropic-ai/sdk'
import { getLLMConfig } from './config'

let currentAbortController: AbortController | null = null

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    await client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    })
    return true
  } catch (err: any) {
    if (err?.status === 401) return false
    // Other errors (rate limit, network) mean the key might be valid
    if (err?.status === 429 || err?.status === 529) return true
    return false
  }
}

export async function sendMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  onToken: (text: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: Error) => void,
): Promise<void> {
  const config = getLLMConfig()
  const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })

  // T038: Set up abort controller for Escape cancellation
  currentAbortController = new AbortController()

  try {
    const stream = client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages,
    }, { signal: currentAbortController.signal })

    let fullResponse = ''

    stream.on('text', (text) => {
      fullResponse += text
      onToken(text)
    })

    stream.on('end', () => {
      currentAbortController = null
      onComplete(fullResponse)
    })

    stream.on('error', (error) => {
      currentAbortController = null
      onError(error instanceof Error ? error : new Error(String(error)))
    })

    await stream.finalMessage()
  } catch (err: any) {
    currentAbortController = null
    // Don't report abort errors as failures
    if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
      onComplete('')
      return
    }
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}

/** T038: Abort the current streaming request */
export function abortStream(): void {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
}
