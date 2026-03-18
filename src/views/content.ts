import { getState, setState, subscribe, addToast } from '../store/state'
import { markDirty } from '../store/sync'
import { parseMarkdownSections, parseSectionsToMarkdown } from '../parsers/spec-parser'
import { markdownToHtml } from '../parsers/markdown-io'
import { renderSectionCard } from '../editors/section-card'
import { deriveArtifactState } from '../models/pipeline'
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

function renderSpecSections(
  leftPane: HTMLElement,
  rightPane: HTMLElement,
  artifact: Artifact,
): void {
  const sections = parseMarkdownSections(artifact.content)

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

  for (let i = 0; i < sections.length; i++) {
    const card = renderSectionCard(sections[i], i, handleSectionUpdate)

    // T044: Make user story sections draggable
    if (isUserStory(sections[i])) {
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
        // Clean up all drop indicators
        leftPane.querySelectorAll('.section-card').forEach(el => {
          ;(el as HTMLElement).style.borderTop = ''
        })
      })

      card.addEventListener('dragover', (e: DragEvent) => {
        if (dragSourceIndex === null) return
        // Only allow drop on other user story cards
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

        // Reorder sections
        const [movedSection] = sections.splice(dragSourceIndex, 1)
        const targetIdx = dragSourceIndex < i ? i - 1 : i
        sections.splice(targetIdx, 0, movedSection)

        // Update priority labels
        updatePriorityLabels(sections)

        // Re-serialize
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

    leftPane.appendChild(card)
  }

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
