const PLACEHOLDER_PATTERNS = [
  /^\[.*\]$/,
  /^\[.*\]\.?$/m,
  /\[NEEDS CLARIFICATION/,
  /\[Describe this/,
  /\[What it represents/,
  /\[specific capability/,
  /\[boundary condition/,
  /\[initial state\]/,
  /\[action\]/,
  /\[expected outcome\]/,
  /\[trigger\]/,
  /\[type\]/,
  /\[handling\]/,
  /\[Rule in plain language\]/,
  /\[state\]/,
  /\[list.*states\]/,
  /\[what causes/,
  /\[conditions that/,
  /\[WCAG level/,
  /\[How users interact/,
  /\[List the UI elements/,
  /\[How the interface adapts/,
  /\[Measurable outcome\]/,
  /\[What it means in this project\]/,
  /\[Words to avoid/,
  /\[Term\]/,
]

export function isSectionFilled(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length <= 20) return false

  const stripped = trimmed
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\|[-\s|]+\|/g, '')
    .replace(/\*{1,3}/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^\s*[-*]\s*/gm, '')
    .replace(/^\s*\d+\.\s*/gm, '')
    .trim()

  if (stripped.length <= 20) return false

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(stripped)) return false
  }

  const lines = stripped.split('\n').filter(l => l.trim().length > 0)
  const placeholderLines = lines.filter(l => /^\[.*\]/.test(l.trim()))
  if (lines.length > 0 && placeholderLines.length / lines.length > 0.5) return false

  return true
}
