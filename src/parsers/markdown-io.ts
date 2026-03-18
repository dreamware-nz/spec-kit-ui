import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function markdownToHtml(input: string): string {
  const raw = marked.parse(input, { async: false }) as string
  return DOMPurify.sanitize(raw)
}

export function stripMarkdownToText(input: string): string {
  return input
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
