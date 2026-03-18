import './styles/reset.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/responsive.css'

import { getDB, getAllProjects, getArtifactsByProject } from './store/db'
import { getState, setState, subscribe, addToast } from './store/state'
import { startAutoSave } from './store/sync'
import { renderShell } from './views/shell'
import { renderEmptyState } from './views/empty-state'
import { renderDiscoveryLayout } from './views/discovery-layout'
import { renderSidebar } from './views/sidebar'
import { renderToasts } from './views/toast'
import { initKeyboardNav } from './views/keyboard'
import { initCommandPalette } from './views/command-palette'
import { hasApiKey } from './llm/config'
import { renderApiKeyModal } from './views/api-key-modal'
import { getConversationByProject } from './store/db'
import type { Artifact } from './models/artifact'

/** T055: Show skeleton loading placeholders while DB initializes */
function showSkeletonLoading(app: HTMLElement): void {
  const shell = document.createElement('div')
  shell.className = 'app-shell'
  shell.id = 'skeleton-shell'

  // Skeleton sidebar
  const sidebar = document.createElement('aside')
  sidebar.className = 'sidebar'
  sidebar.setAttribute('aria-label', 'Loading navigation')

  const titleSkeleton = document.createElement('div')
  titleSkeleton.className = 'skeleton skeleton-title'
  sidebar.appendChild(titleSkeleton)

  for (let i = 0; i < 5; i++) {
    const item = document.createElement('div')
    item.className = 'skeleton skeleton-sidebar-item'
    sidebar.appendChild(item)
  }

  // Skeleton content
  const content = document.createElement('main')
  content.className = 'content-panel'
  content.style.padding = 'var(--space-4)'
  content.setAttribute('aria-label', 'Loading content')

  const contentTitle = document.createElement('div')
  contentTitle.className = 'skeleton skeleton-title'
  content.appendChild(contentTitle)

  for (let i = 0; i < 4; i++) {
    const card = document.createElement('div')
    card.className = 'skeleton skeleton-card'
    content.appendChild(card)
  }

  shell.appendChild(sidebar)
  shell.appendChild(content)
  app.appendChild(shell)
}

function removeSkeletonLoading(app: HTMLElement): void {
  const skeleton = app.querySelector('#skeleton-shell')
  if (skeleton) skeleton.remove()
}

async function init(): Promise<void> {
  const app = document.getElementById('app')!

  // T055: Show skeleton while loading
  showSkeletonLoading(app)

  try {
    // Initialize database
    await getDB()

    // Load projects from DB
    const projects = await getAllProjects()
    const artifacts = new Map<string, Artifact>()

    // Load artifacts for all projects
    for (const project of projects) {
      const projectArtifacts = await getArtifactsByProject(project.id)
      for (const artifact of projectArtifacts) {
        artifacts.set(artifact.id, artifact)
      }
    }

    // Set initial state
    setState({
      projects,
      artifacts,
      currentProjectId: projects.length > 0 ? projects[projects.length - 1].id : null,
    })

    // If there's a current project, set the first artifact as current
    const state = getState()
    if (state.currentProjectId) {
      const projectArtifacts = [...state.artifacts.values()].filter(
        a => a.projectId === state.currentProjectId,
      )
      if (projectArtifacts.length > 0) {
        setState({ currentArtifactId: projectArtifacts[0].id })
      }
    }

    // T022: Restore conversation if project exists
    const currentState = getState()
    if (currentState.currentProjectId) {
      const existingConversation = await getConversationByProject(currentState.currentProjectId)
      if (existingConversation) {
        setState({ conversation: existingConversation })
      }
    }

    // Remove skeleton and render real UI
    removeSkeletonLoading(app)

    // Render shell
    const { sidebar, content } = renderShell(app)

    // Render main content area — with API key gate for discovery
    function launchDiscovery(): void {
      renderMainContent(content)
    }

    if (!hasApiKey()) {
      renderApiKeyModal(app, () => {
        launchDiscovery()
      })
      // Still render sidebar and empty content in the background
      renderMainContent(content)
    } else {
      launchDiscovery()
    }

    // Subscribe to state changes that require content re-routing
    let lastProjectId = getState().currentProjectId
    let lastHadProjects = getState().projects.length > 0
    subscribe((s) => {
      const hasProjects = s.projects.length > 0
      if (hasProjects !== lastHadProjects || s.currentProjectId !== lastProjectId) {
        lastHadProjects = hasProjects
        lastProjectId = s.currentProjectId
        renderMainContent(content)
      }
    })

    // Render sidebar with pipeline navigation
    renderSidebar(sidebar)

    // Render toasts
    const toastContainer = app.querySelector('.toast-container') as HTMLElement
    if (toastContainer) {
      renderToasts(toastContainer)
    }

    // Start auto-save
    startAutoSave()

    // T052: Initialize keyboard navigation
    initKeyboardNav()

    // T053: Initialize command palette
    initCommandPalette()
  } catch (err) {
    // T056: Error state for initialization failure
    removeSkeletonLoading(app)
    const errorState = document.createElement('div')
    errorState.className = 'error-state'
    errorState.style.margin = 'var(--space-8) auto'
    errorState.style.maxWidth = '480px'

    const icon = document.createElement('div')
    icon.className = 'error-state-icon'
    icon.textContent = '\u26A0'
    icon.setAttribute('aria-hidden', 'true')
    errorState.appendChild(icon)

    const msg = document.createElement('div')
    msg.className = 'error-state-message'
    msg.textContent = `Failed to initialize: ${err instanceof Error ? err.message : 'Unknown error'}`
    errorState.appendChild(msg)

    const retryBtn = document.createElement('button')
    retryBtn.className = 'btn btn--primary'
    retryBtn.textContent = 'Retry'
    retryBtn.addEventListener('click', () => {
      while (app.firstChild) app.removeChild(app.firstChild)
      init().catch(console.error)
    })
    errorState.appendChild(retryBtn)

    app.appendChild(errorState)
    addToast('Failed to load application', 'error')
  }
}

function renderMainContent(content: HTMLElement): void {
  // Clear content
  while (content.firstChild) {
    content.removeChild(content.firstChild)
  }

  const state = getState()
  if (state.projects.length === 0) {
    renderEmptyState(content)
  } else {
    renderDiscoveryLayout(content)
  }
}

init().catch(console.error)
