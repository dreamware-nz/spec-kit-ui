import './styles/reset.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/responsive.css'

import { getDB, getAllProjects, getArtifactsByProject } from './store/db'
import { getState, setState, subscribe } from './store/state'
import { startAutoSave } from './store/sync'
import { renderShell } from './views/shell'
import { renderEmptyState } from './views/empty-state'
import { renderContentPanel } from './views/content'
import { renderToasts } from './views/toast'
import type { Artifact } from './models/artifact'

async function init(): Promise<void> {
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

  // Render shell
  const app = document.getElementById('app')!
  const { sidebar, content } = renderShell(app)

  // Render main content area
  renderMainContent(content)

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

  // Sidebar placeholder
  const sidebarTitle = document.createElement('div')
  sidebarTitle.style.fontWeight = '600'
  sidebarTitle.style.fontSize = 'var(--text-lg)'
  sidebarTitle.style.marginBottom = 'var(--space-4)'
  sidebarTitle.textContent = 'Spec Workbench'
  sidebar.appendChild(sidebarTitle)

  const sidebarInfo = document.createElement('div')
  sidebarInfo.style.fontSize = 'var(--text-sm)'
  sidebarInfo.style.color = 'var(--color-text-secondary)'
  sidebarInfo.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`
  sidebar.appendChild(sidebarInfo)

  // Render toasts
  const toastContainer = app.querySelector('.toast-container') as HTMLElement
  if (toastContainer) {
    renderToasts(toastContainer)
  }

  // Start auto-save
  startAutoSave()
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
    renderContentPanel(content)
  }
}

init().catch(console.error)
