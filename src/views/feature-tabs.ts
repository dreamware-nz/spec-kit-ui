import { getState, setState, subscribe, addToast } from '../store/state'
import { createArtifact } from '../models/artifact'
import { createArtifactInDB } from '../store/db'
import { scaffoldArtifact } from '../parsers/template'
import { markConversationDirty } from '../store/sync'
import { parseMarkdownSections } from '../parsers/spec-parser'
import type { Artifact } from '../models/artifact'

/**
 * T023: Feature tabs UI — tab bar above spec panel for switching between feature specs.
 * Each tab shows feature name derived from spec title. "+" button to create new feature tab.
 */
export function renderFeatureTabs(container: HTMLElement): void {
  const tabBar = document.createElement('div')
  tabBar.className = 'feature-tabs'
  tabBar.setAttribute('role', 'tablist')
  tabBar.setAttribute('aria-label', 'Feature specs')
  container.appendChild(tabBar)

  function render(): void {
    while (tabBar.firstChild) {
      tabBar.removeChild(tabBar.firstChild)
    }

    const state = getState()
    if (!state.currentProjectId) return

    // Get all spec artifacts for the current project
    const specArtifacts = [...state.artifacts.values()].filter(
      a => a.projectId === state.currentProjectId && a.type === 'spec'
    )

    for (const artifact of specArtifacts) {
      const tab = document.createElement('button')
      tab.className = 'feature-tab'
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', String(artifact.id === state.currentArtifactId))

      if (artifact.id === state.currentArtifactId) {
        tab.classList.add('active')
      }

      // Derive feature name from spec content title
      const featureName = deriveFeatureName(artifact.content)

      // Compute coverage percentage
      const sections = parseMarkdownSections(artifact.content)
      const total = sections.length
      const filled = sections.filter(s => s.content.trim().length > 20).length
      const percent = total > 0 ? Math.round((filled / total) * 100) : 0

      tab.textContent = `${featureName} (${percent}%)`
      tab.title = `Switch to ${featureName}`

      tab.addEventListener('click', () => {
        switchToFeature(artifact.id)
      })

      tabBar.appendChild(tab)
    }

    // "+" button to create new feature tab
    const addBtn = document.createElement('button')
    addBtn.className = 'feature-tab'
    addBtn.textContent = '+'
    addBtn.title = 'Add new feature'
    addBtn.setAttribute('aria-label', 'Add new feature spec')

    addBtn.addEventListener('click', () => {
      void createNewFeature()
    })

    tabBar.appendChild(addBtn)
  }

  subscribe(render)
  render()
}

/** Derive feature name from spec content (first heading or fallback) */
export function deriveFeatureName(content: string): string {
  if (!content) return 'Untitled'
  const sections = parseMarkdownSections(content)
  if (sections.length > 0) {
    const title = sections[0].title
    if (title.length > 0 && title.length < 50) return title
  }
  const firstLine = content.split('\n')[0]?.replace(/^#+\s*/, '').trim()
  return firstLine?.slice(0, 40) || 'Untitled'
}

/**
 * T024: When switching features, update conversation context.
 * Adds visual separator in chat.
 */
function switchToFeature(artifactId: string): void {
  const state = getState()
  if (state.currentArtifactId === artifactId) return

  const artifact = state.artifacts.get(artifactId)
  if (!artifact) return

  const featureName = deriveFeatureName(artifact.content)

  setState({ currentArtifactId: artifactId })

  // Add a visual separator to the conversation
  if (state.conversation) {
    const separator = {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: `--- Switching to: ${featureName} ---`,
      specUpdates: [],
      timestamp: new Date().toISOString(),
    }
    state.conversation.messages.push(separator)
    markConversationDirty()
  }
}

/** Create a new feature spec artifact */
async function createNewFeature(): Promise<void> {
  const state = getState()
  if (!state.currentProjectId) return

  const content = scaffoldArtifact('spec')
  const artifact = createArtifact(state.currentProjectId, 'spec', 'specify', content)
  await createArtifactInDB(artifact)

  const artifacts = new Map(state.artifacts)
  artifacts.set(artifact.id, artifact)

  setState({
    artifacts,
    currentArtifactId: artifact.id,
  })

  addToast('New feature spec created', 'success')
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
