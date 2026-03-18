import { createProjectInDB, createArtifactInDB } from '../store/db'
import { getState, setState } from '../store/state'
import { createProject } from '../models/project'
import { createArtifact } from '../models/artifact'
import { scaffoldSpecFromIdea } from '../parsers/template'

const DRAFT_KEY = 'spec-workbench-draft-idea'

export function renderEmptyState(container: HTMLElement): void {
  const emptyState = document.createElement('div')
  emptyState.className = 'empty-state'

  const heading = document.createElement('h2')
  heading.textContent = 'Spec Workbench'
  emptyState.appendChild(heading)

  const description = document.createElement('p')
  description.textContent = 'Describe your feature idea to get started'
  emptyState.appendChild(description)

  const textarea = document.createElement('textarea')
  textarea.className = 'textarea'
  textarea.placeholder = 'What do you want to build?'
  textarea.rows = 6
  textarea.style.maxWidth = '480px'
  emptyState.appendChild(textarea)

  // T024: Restore draft from localStorage
  const savedDraft = localStorage.getItem(DRAFT_KEY)
  if (savedDraft) {
    textarea.value = savedDraft
  }

  // T024: Auto-save draft on 2-second pause
  let draftTimer: ReturnType<typeof setTimeout> | null = null
  textarea.addEventListener('input', () => {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, textarea.value)
    }, 2000)
  })

  const button = document.createElement('button')
  button.className = 'btn btn--primary'
  button.textContent = 'Create Spec'
  emptyState.appendChild(button)

  button.addEventListener('click', async () => {
    const idea = textarea.value.trim()
    if (!idea) return

    const specContent = scaffoldSpecFromIdea(idea)
    const projectName = idea.slice(0, 40)
    const project = createProject(projectName)
    const artifact = createArtifact(project.id, 'spec', 'specify', specContent)

    await createProjectInDB(project)
    await createArtifactInDB(artifact)

    // T024: Clear draft after successful creation
    localStorage.removeItem(DRAFT_KEY)

    const state = getState()
    const artifacts = new Map(state.artifacts)
    artifacts.set(artifact.id, artifact)

    setState({
      projects: [...state.projects, project],
      artifacts,
      currentProjectId: project.id,
      currentArtifactId: artifact.id,
    })
  })

  container.appendChild(emptyState)
}
