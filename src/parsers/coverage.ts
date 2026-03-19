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
  /\[task description\]/,
  /\[Primary requirement/,
  /\[FEATURE\]/,
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

/**
 * Check if an artifact's content is just a template scaffold with no real user/LLM content.
 * Used to determine if a stage is "complete" and whether to auto-prompt on stage transition.
 */
export function isTemplateOnly(content: string | undefined | null): boolean {
  if (!content || content.trim().length === 0) return true

  // Strip all template markers and see if anything real remains
  let stripped = content
    .replace(/<!--[\s\S]*?-->/g, '')     // HTML comments
    .replace(/^#.*$/gm, '')              // Headings
    .replace(/\*{1,3}[^*]*\*{1,3}/g, '') // Bold/italic markers with content
    .replace(/\|[-\s|]+\|/g, '')         // Table separators
    .replace(/^\s*[-*]\s*$/gm, '')       // Empty list markers
    .replace(/```[\s\S]*?```/g, '')      // Code blocks

  // Remove all placeholder content
  for (const pattern of PLACEHOLDER_PATTERNS) {
    stripped = stripped.replace(new RegExp(pattern.source, 'gm'), '')
  }

  // Remove known template-only lines
  stripped = stripped
    .replace(/\*\*Feature Branch\*\*:.*/g, '')
    .replace(/\*\*Created\*\*:.*/g, '')
    .replace(/\*\*Status\*\*:.*/g, '')
    .replace(/\*\*Input\*\*:.*/g, '')
    .replace(/\*\*Branch\*\*:.*/g, '')
    .replace(/\*\*Date\*\*:.*/g, '')
    .replace(/\[FEATURE NAME\]/g, '')
    .replace(/\[FEATURE\]/g, '')
    .replace(/\[DATE\]/g, '')
    .trim()

  // If less than 30 chars of real content remain, it's template-only
  const realLines = stripped.split('\n').filter(l => l.trim().length > 3)
  return realLines.length < 3
}
