import Anthropic from '@anthropic-ai/sdk'
import { getLLMConfig } from './config'

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

  try {
    const stream = client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages,
    })

    let fullResponse = ''

    stream.on('text', (text) => {
      fullResponse += text
      onToken(text)
    })

    stream.on('end', () => {
      onComplete(fullResponse)
    })

    stream.on('error', (error) => {
      onError(error instanceof Error ? error : new Error(String(error)))
    })

    await stream.finalMessage()
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}
