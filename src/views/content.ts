import { getState, setState, subscribe, addToast } from '../store/state'
import { markDirty } from '../store/sync'
import { parseMarkdownSections, parseSectionsToMarkdown } from '../parsers/spec-parser'
import { markdownToHtml } from '../parsers/markdown-io'
import { renderSectionCard } from '../editors/section-card'
import { deriveArtifactState } from '../models/pipeline'
import { handleSectionFocus } from './chat'
import { findCrossFeatureEntities, deriveFeatureName } from './feature-tabs'
import type { Artifact, Section } from '../models/artifact'

let previewTimer: ReturnType<typeof setTimeout> | null = null
let currentEditorView: import('@codemirror/view').EditorView | null = null

export function renderContentPanel(container: HTMLElement): void {
  function render(): void {
    // Cleanup previous editor
    if (currentEditorView) {
      currentEditorView.destroy()
      currentEditorView = null
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    const state = getState()
    const artifact = state.currentArtifactId
      ? state.artifacts.get(state.currentArtifactId)
      : null

    if (!artifact) {
      const msg = document.createElement('p')
      msg.style.padding = 'var(--space-4)'
      msg.textContent = 'Select an artifact to begin editing.'
      container.appendChild(msg)
      return
    }

    // Toolbar
    const toolbar = document.createElement('div')
    toolbar.className = 'content-toolbar'
    toolbar.style.display = 'flex'
    toolbar.style.alignItems = 'center'
    toolbar.style.gap = 'var(--space-2)'
    toolbar.style.padding = 'var(--space-2) var(--space-4)'
    toolbar.style.borderBottom = '1px solid var(--color-border)'

    const artifactName = document.createElement('span')
    artifactName.style.flex = '1'
    artifactName.style.fontWeight = '600'
    artifactName.textContent = artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1)
    toolbar.appendChild(artifactName)

    // Export button (T030)
    const exportBtn = document.createElement('button')
    exportBtn.className = 'btn'
    exportBtn.textContent = 'Export'
    exportBtn.addEventListener('click', () => handleExport(artifact))
    toolbar.appendChild(exportBtn)

    // Import button (T032)
    const importBtn = document.createElement('button')
    importBtn.className = 'btn'
    importBtn.textContent = 'Import'
    importBtn.addEventListener('click', () => handleImport(artifact))
    toolbar.appendChild(importBtn)

    container.appendChild(toolbar)

    // Split view
    const splitView = document.createElement('div')
    splitView.style.display = 'flex'
    splitView.style.flex = '1'
    splitView.style.overflow = 'hidden'

    const leftPane = document.createElement('div')
    leftPane.style.flex = '1'
    leftPane.style.overflow = 'auto'
    leftPane.style.padding = 'var(--space-4)'

    const rightPane = document.createElement('div')
    rightPane.style.flex = '1'
    rightPane.style.overflow = 'auto'
    rightPane.style.padding = 'var(--space-4)'
    rightPane.style.borderLeft = '1px solid var(--color-border)'

    if (artifact.type === 'spec') {
      // T029: Render as section cards
      renderSpecSections(leftPane, rightPane, artifact)
    } else {
      // Non-spec: CodeMirror editor + preview
      renderRawEditor(leftPane, rightPane, artifact)
    }

    splitView.appendChild(leftPane)
    splitView.appendChild(rightPane)
    container.appendChild(splitView)
  }

  subscribe(() => {
    render()
  })

  render()
}

/** Check if a section is a user story */
function isUserStory(section: Section): boolean {
  return /^User Story/i.test(section.title)
}

/** Update priority labels in user story titles (P1, P2, ...) */
function updatePriorityLabels(sections: Section[]): void {
  let priority = 1
  for (const section of sections) {
    if (isUserStory(section)) {
      // Replace existing priority label or add one
      section.title = section.title.replace(/\s*\(P\d+\)\s*$/, '')
      section.title = `${section.title} (P${priority})`
      priority++
    }
  }
}

/** Group sections into h2 parents with nested h3 children */
interface SectionGroup {
  parent: Section
  parentIndex: number
  children: Array<{ section: Section; index: number }>
}

function groupSections(sections: Section[]): Array<SectionGroup | { section: Section; index: number }> {
  const result: Array<SectionGroup | { section: Section; index: number }> = []
  let currentGroup: SectionGroup | null = null

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    if (section.headingLevel <= 2) {
      // Flush previous group
      if (currentGroup) result.push(currentGroup)
      currentGroup = { parent: section, parentIndex: i, children: [] }
    } else if (currentGroup && section.headingLevel > 2) {
      currentGroup.children.push({ section, index: i })
    } else {
      // Orphan h3+ without a parent h2 — render standalone
      if (currentGroup) { result.push(currentGroup); currentGroup = null }
      result.push({ section, index: i })
    }
  }
  if (currentGroup) result.push(currentGroup)
  return result
}

function renderSpecSections(
  leftPane: HTMLElement,
  rightPane: HTMLElement,
  artifact: Artifact,
): void {
  const sections = parseMarkdownSections(artifact.content)

  // Ensure all sections start collapsed
  for (const section of sections) {
    section.collapsed = true
  }

  // Track all rendered cards for accordion behavior
  const allCards: HTMLElement[] = []

  function collapseAllExcept(exceptCard: HTMLElement): void {
    for (const c of allCards) {
      if (c !== exceptCard && c.classList.contains('expanded')) {
        c.classList.remove('expanded')
        const hdr = c.querySelector('.section-card-header') as HTMLElement
        if (hdr) hdr.setAttribute('aria-expanded', 'false')
        // Find the section index and mark collapsed
        const idx = c.dataset.sectionIndex
        if (idx !== undefined) {
          const si = parseInt(idx, 10)
          if (!isNaN(si) && sections[si]) sections[si].collapsed = true
        }
      }
    }
  }

  function handleSectionUpdate(index: number, content: string): void {
    sections[index].content = content

    // T029: Re-serialize and update artifact
    const newContent = parseSectionsToMarkdown(sections)
    artifact.content = newContent
    artifact.updatedAt = new Date().toISOString()

    // T033: Recalculate artifact state
    artifact.state = deriveArtifactState(newContent, artifact.type)

    const state = getState()
    const artifacts = new Map(state.artifacts)
    artifacts.set(artifact.id, artifact)
    // Update state without triggering full re-render via direct map update
    state.artifacts = artifacts

    markDirty(artifact.id)

    // Debounced preview update
    updatePreviewDebounced(rightPane, newContent)
  }

  // T044: Track drag state for user story reordering
  let dragSourceIndex: number | null = null

  function attachAccordion(card: HTMLElement, sectionIndex: number): void {
    card.dataset.sectionIndex = String(sectionIndex)
    allCards.push(card)
    const headerEl = card.querySelector('.section-card-header') as HTMLElement
    if (headerEl) {
      headerEl.addEventListener('click', () => {
        // Accordion: when expanding, collapse all others
        if (!card.classList.contains('expanded')) {
          // The section-card click handler will add 'expanded' after this event
          // We need to collapse others proactively
          setTimeout(() => collapseAllExcept(card), 0)
        }
      })
    }
  }

  function attachDrag(card: HTMLElement, i: number): void {
    if (!isUserStory(sections[i])) return
    card.draggable = true
    card.dataset.sectionIndex = String(i)

    card.addEventListener('dragstart', (e: DragEvent) => {
      dragSourceIndex = i
      card.style.opacity = '0.5'
      e.dataTransfer?.setData('text/plain', String(i))
    })

    card.addEventListener('dragend', () => {
      card.style.opacity = '1'
      dragSourceIndex = null
      leftPane.querySelectorAll('.section-card').forEach(el => {
        ;(el as HTMLElement).style.borderTop = ''
      })
    })

    card.addEventListener('dragover', (e: DragEvent) => {
      if (dragSourceIndex === null) return
      if (!isUserStory(sections[i])) return
      e.preventDefault()
      card.style.borderTop = '3px solid var(--color-accent)'
    })

    card.addEventListener('dragleave', () => {
      card.style.borderTop = ''
    })

    card.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault()
      card.style.borderTop = ''
      if (dragSourceIndex === null || dragSourceIndex === i) return

      const [movedSection] = sections.splice(dragSourceIndex, 1)
      const targetIdx = dragSourceIndex < i ? i - 1 : i
      sections.splice(targetIdx, 0, movedSection)

      updatePriorityLabels(sections)

      const newContent = parseSectionsToMarkdown(sections)
      artifact.content = newContent
      artifact.updatedAt = new Date().toISOString()
      artifact.state = deriveArtifactState(newContent, artifact.type)

      const state = getState()
      const artifacts = new Map(state.artifacts)
      artifacts.set(artifact.id, artifact)
      setState({ artifacts })

      markDirty(artifact.id)
    })
  }

  function attachFocus(card: HTMLElement, i: number): void {
    const headerEl = card.querySelector('.section-card-header') as HTMLElement
    if (headerEl) {
      headerEl.addEventListener('dblclick', (e) => {
        e.preventDefault()
        e.stopPropagation()
        handleSectionFocus(sections[i].title)
      })
    }
    const state = getState()
    if (state.focusSection && sections[i].title.toLowerCase().includes(state.focusSection.toLowerCase())) {
      card.classList.add('section-card--focused')
    }
  }

  // Group sections: h2 parents contain h3 children
  const groups = groupSections(sections)

  for (const group of groups) {
    if ('parent' in group && group.children.length > 0) {
      // Render as a collapsible group with nested children
      const groupContainer = document.createElement('div')
      groupContainer.className = 'section-group'

      // Group header (the h2 parent card)
      const parentCard = renderSectionCard(group.parent, group.parentIndex, handleSectionUpdate)

      // Add child count to the header title
      const titleEl = parentCard.querySelector('.section-card-title') as HTMLElement
      if (titleEl) {
        const childCount = group.children.length
        const label = isUserStory(group.children[0]?.section) ? 'stories' : 'items'
        const countBadge = document.createElement('span')
        countBadge.style.fontSize = 'var(--text-xs)'
        countBadge.style.color = 'var(--color-text-secondary)'
        countBadge.style.marginLeft = 'var(--space-1)'
        countBadge.style.fontWeight = 'normal'
        countBadge.textContent = `(${childCount} ${label})`
        titleEl.appendChild(countBadge)
      }

      attachAccordion(parentCard, group.parentIndex)
      attachDrag(parentCard, group.parentIndex)
      attachFocus(parentCard, group.parentIndex)
      groupContainer.appendChild(parentCard)

      // Nested children container — only visible when parent is expanded
      const childrenContainer = document.createElement('div')
      childrenContainer.className = 'section-group-children'
      childrenContainer.style.paddingLeft = 'var(--space-4)'
      childrenContainer.style.display = 'none'

      // Show/hide children when parent expands/collapses
      const parentHeader = parentCard.querySelector('.section-card-header') as HTMLElement
      if (parentHeader) {
        parentHeader.addEventListener('click', () => {
          // Toggle after the section-card handler runs
          setTimeout(() => {
            childrenContainer.style.display = parentCard.classList.contains('expanded') ? 'block' : 'none'
          }, 0)
        })
      }

      for (const child of group.children) {
        const childCard = renderSectionCard(child.section, child.index, handleSectionUpdate)
        attachDrag(childCard, child.index)
        attachFocus(childCard, child.index)
        childrenContainer.appendChild(childCard)
      }

      groupContainer.appendChild(childrenContainer)
      leftPane.appendChild(groupContainer)
    } else if ('parent' in group) {
      // h2 with no children — render standalone
      const card = renderSectionCard(group.parent, group.parentIndex, handleSectionUpdate)
      attachAccordion(card, group.parentIndex)
      attachDrag(card, group.parentIndex)
      attachFocus(card, group.parentIndex)
      leftPane.appendChild(card)
    } else {
      // Standalone section (orphan h3+)
      const card = renderSectionCard(group.section, group.index, handleSectionUpdate)
      attachAccordion(card, group.index)
      attachDrag(card, group.index)
      attachFocus(card, group.index)
      leftPane.appendChild(card)
    }
  }

  // T027: Cross-feature entity linking
  renderCrossFeatureLinks(leftPane, artifact)

  // Initial preview — markdownToHtml sanitizes via DOMPurify
  updatePreview(rightPane, artifact.content)
}

function renderRawEditor(
  leftPane: HTMLElement,
  rightPane: HTMLElement,
  artifact: Artifact,
): void {
  // Dynamic import to avoid loading CodeMirror when not needed
  import('../editors/markdown').then(({ createEditor }) => {
    currentEditorView = createEditor(leftPane, artifact.content, (content) => {
      artifact.content = content
      artifact.updatedAt = new Date().toISOString()

      // T033: Recalculate artifact state
      artifact.state = deriveArtifactState(content, artifact.type)

      const state = getState()
      state.artifacts.set(artifact.id, artifact)

      markDirty(artifact.id)
      updatePreviewDebounced(rightPane, content)
    })
  })

  // Initial preview — markdownToHtml sanitizes via DOMPurify
  updatePreview(rightPane, artifact.content)
}

/** Render sanitized HTML preview (markdownToHtml uses DOMPurify) */
function updatePreview(previewPane: HTMLElement, content: string): void {
  // Safe: markdownToHtml sanitizes output through DOMPurify
  const sanitizedHtml = markdownToHtml(content)
  previewPane.textContent = ''
  const wrapper = document.createElement('div')
  wrapper.insertAdjacentHTML('afterbegin', sanitizedHtml)
  previewPane.appendChild(wrapper)
}

function updatePreviewDebounced(previewPane: HTMLElement, content: string): void {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    updatePreview(previewPane, content)
  }, 300)
}

// T030: Export
function handleExport(artifact: Artifact): void {
  const content = artifact.content

  // Validation for spec type
  if (artifact.type === 'spec') {
    const hasScenarios = /## User Scenarios/i.test(content)
    const hasRequirements = /## Requirements/i.test(content)
    const hasCriteria = /## Success Criteria/i.test(content)
    if (!hasScenarios || !hasRequirements || !hasCriteria) {
      addToast('Warning: Spec is missing required sections (User Scenarios, Requirements, or Success Criteria)', 'info')
    }
  }

  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${artifact.type}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  addToast('Exported successfully', 'success')
}

// T027: Cross-feature entity linking
function renderCrossFeatureLinks(container: HTMLElement, currentArtifact: Artifact): void {
  const state = getState()
  if (!state.currentProjectId) return

  const entityMap = findCrossFeatureEntities(state.currentProjectId, state.artifacts)
  if (entityMap.size === 0) return

  const currentFeatureName = deriveFeatureName(currentArtifact.content)

  // Check if any entities in the current artifact also exist in other features
  const crossLinks: Array<{ entity: string; otherFeatures: string[] }> = []
  for (const [entity, features] of entityMap) {
    if (features.includes(currentFeatureName) && features.length > 1) {
      const others = features.filter(f => f !== currentFeatureName)
      crossLinks.push({ entity, otherFeatures: others })
    }
  }

  if (crossLinks.length === 0) return

  const linksDiv = document.createElement('div')
  linksDiv.style.padding = 'var(--space-2) var(--space-3)'
  linksDiv.style.marginTop = 'var(--space-2)'
  linksDiv.style.fontSize = 'var(--text-xs)'
  linksDiv.style.color = 'var(--color-text-secondary)'
  linksDiv.style.background = 'var(--color-surface)'
  linksDiv.style.borderRadius = 'var(--radius-sm)'
  linksDiv.style.border = '1px dashed var(--color-border)'

  const header = document.createElement('div')
  header.style.fontWeight = '600'
  header.style.marginBottom = 'var(--space-1)'
  header.textContent = 'Shared entities:'
  linksDiv.appendChild(header)

  for (const link of crossLinks) {
    const item = document.createElement('div')
    item.style.marginBottom = 'var(--space-1)'
    item.innerHTML = '' // clear
    const entitySpan = document.createElement('span')
    entitySpan.style.fontWeight = '600'
    entitySpan.textContent = link.entity
    item.appendChild(entitySpan)

    const alsoIn = document.createElement('span')
    alsoIn.style.color = 'var(--color-accent)'
    alsoIn.textContent = ` Also in: ${link.otherFeatures.join(', ')}`
    item.appendChild(alsoIn)

    linksDiv.appendChild(item)
  }

  container.appendChild(linksDiv)
}

// T032: Import
function handleImport(artifact: Artifact): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md'

  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const content = reader.result as string

        // Validate structure by parsing
        const sections = parseMarkdownSections(content)
        if (sections.length === 0) {
          addToast('Import failed: No markdown sections found in file', 'error')
          return
        }

        // Update artifact with raw markdown (sanitization only for preview via markdownToHtml)
        artifact.content = content
        artifact.updatedAt = new Date().toISOString()

        // T033: Recalculate state
        artifact.state = deriveArtifactState(content, artifact.type)

        const artifacts = new Map(getState().artifacts)
        artifacts.set(artifact.id, artifact)
        setState({ artifacts })

        markDirty(artifact.id)
        addToast('Imported successfully', 'success')
      } catch (err) {
        addToast(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
      }
    }
    reader.onerror = () => {
      addToast('Import failed: Could not read file', 'error')
    }
    reader.readAsText(file)
  })

  input.click()
}
