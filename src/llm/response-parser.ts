import type { SpecUpdate } from '../models/conversation'

const START_DELIMITER = '<<<SPEC_UPDATE'
const END_DELIMITER = '<<<END_UPDATE>>>'

export interface ResponseParserCallbacks {
  onText: (text: string) => void
  onSpecUpdate: (update: SpecUpdate) => void
}

export function createResponseParser(callbacks: ResponseParserCallbacks) {
  let buffer = ''
  let inUpdate = false
  let updateBuffer = ''
  let currentSection = ''
  let currentAction: SpecUpdate['action'] = 'replace'

  function feed(token: string): void {
    buffer += token

    while (buffer.length > 0) {
      if (inUpdate) {
        // Combine updateBuffer and buffer to search for END_DELIMITER across boundaries
        const combined = updateBuffer + buffer
        const endIdx = combined.indexOf(END_DELIMITER)
        if (endIdx !== -1) {
          const content = combined.slice(0, endIdx)
          const remaining = combined.slice(endIdx + END_DELIMITER.length)
          buffer = remaining
          updateBuffer = ''
          inUpdate = false
          callbacks.onSpecUpdate({
            section: currentSection,
            content: content.trim(),
            action: currentAction,
          })
        } else {
          updateBuffer = combined
          buffer = ''
        }
      } else {
        const startIdx = buffer.indexOf(START_DELIMITER)
        if (startIdx !== -1) {
          // Emit text before the delimiter
          if (startIdx > 0) {
            callbacks.onText(buffer.slice(0, startIdx))
          }
          // Find the closing >>> of the opening delimiter
          const closingIdx = buffer.indexOf('>>>', startIdx)
          if (closingIdx !== -1) {
            const header = buffer.slice(startIdx, closingIdx + 3)
            // Parse section and action from header
            const sectionMatch = header.match(/section="([^"]+)"/)
            const actionMatch = header.match(/action="([^"]+)"/)
            currentSection = sectionMatch ? sectionMatch[1] : 'Unknown'
            currentAction = (actionMatch ? actionMatch[1] : 'replace') as SpecUpdate['action']
            buffer = buffer.slice(closingIdx + 3)
            inUpdate = true
            updateBuffer = ''
          } else {
            // Partial delimiter — wait for more tokens
            if (startIdx > 0) {
              callbacks.onText(buffer.slice(0, startIdx))
              buffer = buffer.slice(startIdx)
            }
            break
          }
        } else {
          // Check if buffer ends with a partial start delimiter
          // Check from longest possible partial match down to shortest
          let partialMatch = false
          const maxCheck = Math.min(START_DELIMITER.length - 1, buffer.length)
          for (let i = maxCheck; i >= 1; i--) {
            if (buffer.endsWith(START_DELIMITER.slice(0, i))) {
              callbacks.onText(buffer.slice(0, buffer.length - i))
              buffer = buffer.slice(buffer.length - i)
              partialMatch = true
              break
            }
          }
          if (!partialMatch) {
            callbacks.onText(buffer)
            buffer = ''
          }
          break
        }
      }
    }
  }

  function flush(): void {
    if (inUpdate) {
      // Unclosed update block — emit as text
      callbacks.onText(START_DELIMITER + updateBuffer)
      inUpdate = false
      updateBuffer = ''
    }
    if (buffer.length > 0) {
      callbacks.onText(buffer)
      buffer = ''
    }
  }

  return { feed, flush }
}
