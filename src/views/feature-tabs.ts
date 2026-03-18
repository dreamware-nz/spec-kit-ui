import { parseMarkdownSections } from '../parsers/spec-parser'
import type { Artifact } from '../models/artifact'

/**
 * Feature utility functions.
 * The tab UI has been removed — features are now listed in the sidebar.
 * These functions remain as they are used by chat.ts and content.ts.
 */

/** Derive a short, meaningful feature name from spec content */
export function deriveFeatureName(content: string): string {
  if (!content) return 'Untitled'
  const sections = parseMarkdownSections(content)
  let raw = ''

  // 1. Try the h1 title first
  if (sections.length > 0) {
    raw = sections[0].title.replace(/^Feature\s+Specification\s*:\s*/i, '').trim()
  }

  // 2. If h1 is a placeholder, try the Overview section content (first sentence)
  if (!raw || /^\[.*\]$/.test(raw)) {
    const overview = sections.find(s => /overview/i.test(s.title))
    if (overview && overview.content) {
      const firstSentence = overview.content
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\[.*?\]/g, '')
        .trim()
        .split(/[.!?\n]/)[0]
        ?.trim()
      if (firstSentence && firstSentence.length > 5 && !/^\[/.test(firstSentence)) {
        raw = firstSentence.length > 50 ? firstSentence.slice(0, 50) : firstSentence
      }
    }
  }

  // 3. If still no name, try the first user story title
  if (!raw || /^\[.*\]$/.test(raw)) {
    const story = sections.find(s => /user story/i.test(s.title))
    if (story) {
      const match = story.title.match(/User Story \d+\s*-\s*(.+?)(?:\s*\(|$)/i)
      if (match) raw = match[1].trim()
    }
  }

  if (!raw || /^\[.*\]$/.test(raw)) return 'New Feature'

  // Strip common leading articles
  raw = raw.replace(/^(a|an|the)\s+/i, '').trim()

  // Title case
  raw = raw
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  // Truncate to ~30 chars
  if (raw.length > 30) {
    raw = raw.slice(0, 27).replace(/\s+\S*$/, '') + '...'
  }

  return raw || 'Untitled'
}

/**
 * T027: Scan all artifacts for matching entity names.
 * Returns a map of entity name -> list of feature names where it appears.
 */
export function findCrossFeatureEntities(
  projectId: string,
  artifacts: Map<string, Artifact>,
): Map<string, string[]> {
  const entityMap = new Map<string, string[]>()

  const specArtifacts = [...artifacts.values()].filter(
    a => a.projectId === projectId && a.type === 'spec'
  )

  for (const artifact of specArtifacts) {
    const featureName = deriveFeatureName(artifact.content)
    const sections = parseMarkdownSections(artifact.content)

    const entitiesSection = sections.find(s =>
      s.title.toLowerCase().includes('key entities') ||
      s.title.toLowerCase().includes('entities')
    )
    if (!entitiesSection) continue

    const entityNames = extractEntityNames(entitiesSection.content)
    for (const name of entityNames) {
      const existing = entityMap.get(name) || []
      if (!existing.includes(featureName)) {
        existing.push(featureName)
      }
      entityMap.set(name, existing)
    }
  }

  return entityMap
}

function extractEntityNames(content: string): string[] {
  const names: string[] = []

  // Match **EntityName** patterns
  const boldPattern = /\*\*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\*\*/g
  let match
  while ((match = boldPattern.exec(content)) !== null) {
    names.push(match[1])
  }

  // Match ### EntityName headings
  const headingPattern = /^###\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/gm
  while ((match = headingPattern.exec(content)) !== null) {
    names.push(match[1])
  }

  // Match table row first column
  const tablePattern = /^\|\s*\*?\*?([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\*?\*?\s*\|/gm
  while ((match = tablePattern.exec(content)) !== null) {
    const name = match[1].trim()
    if (name && !name.startsWith('---') && name !== 'Entity' && name !== 'Name') {
      names.push(name)
    }
  }

  return [...new Set(names)]
}

/**
 * T025: Extract glossary terms from ALL project artifacts, not just current feature.
 */
export function gatherAllGlossaryTerms(
  projectId: string,
  artifacts: Map<string, Artifact>,
): string[] {
  const allTerms: string[] = []

  const specArtifacts = [...artifacts.values()].filter(
    a => a.projectId === projectId && a.type === 'spec'
  )

  for (const artifact of specArtifacts) {
    const sections = parseMarkdownSections(artifact.content)
    const glossary = sections.find(s => s.title.toLowerCase().includes('glossary'))
    if (!glossary) continue

    const lines = glossary.content.split('\n')
    for (const line of lines) {
      const match = line.match(/^\|\s*\*?\*?([^|*]+)\*?\*?\s*\|/)
      if (match) {
        const term = match[1].trim()
        if (term && term !== 'Term' && !term.startsWith('---')) {
          allTerms.push(term)
        }
      }
    }
  }

  return [...new Set(allTerms)]
}
