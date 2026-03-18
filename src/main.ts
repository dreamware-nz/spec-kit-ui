import './styles/reset.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/responsive.css'

import { getDB, getAllProjects, getArtifactsByProject } from './store/db'
import { setState } from './store/state'
import { startAutoSave } from './store/sync'
import { renderShell } from './views/shell'
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

  // Render shell
  const app = document.getElementById('app')!
  const { sidebar, content } = renderShell(app)

  // Placeholder content until US1 is implemented
  if (projects.length === 0) {
    const emptyState = document.createElement('div')
    emptyState.className = 'empty-state'

    const heading = document.createElement('h2')
    heading.textContent = 'Spec Workbench'
    emptyState.appendChild(heading)

    const description = document.createElement('p')
    description.textContent = 'Describe your feature idea to get started. The workbench will help you structure it into a proper specification.'
    emptyState.appendChild(description)

    const textarea = document.createElement('textarea')
    textarea.className = 'textarea'
    textarea.placeholder = 'What do you want to build?'
    textarea.rows = 6
    textarea.style.maxWidth = '480px'
    emptyState.appendChild(textarea)

    const button = document.createElement('button')
    button.className = 'btn btn--primary'
    button.textContent = 'Create Spec'
    emptyState.appendChild(button)

    content.appendChild(emptyState)
  } else {
    const wrapper = document.createElement('div')
    wrapper.style.padding = 'var(--space-4)'
    const msg = document.createElement('p')
    msg.textContent = 'Project loaded. Content panel will be implemented in US1.'
    wrapper.appendChild(msg)
    content.appendChild(wrapper)
  }

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

  // Start auto-save
  startAutoSave()
}

init().catch(console.error)
