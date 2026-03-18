import { getState, setState, addToast, subscribe } from '../store/state'
import { flushAll } from '../store/sync'
import { PIPELINE_STAGES, getStageCompletion } from '../models/pipeline'
import { STAGE_ARTIFACT_MAP, createArtifact } from '../models/artifact'
import { createArtifactInDB, createProjectInDB, deleteProject as deleteProjectFromDB, updateProject as updateProjectInDB, getArtifactsByProject } from '../store/db'
import { scaffoldArtifact } from '../parsers/template'
import { createProject } from '../models/project'
import { deriveFeatureName } from './feature-tabs'
import { switchChatToFeature } from './chat'
import { parseMarkdownSections } from '../parsers/spec-parser'
import type { Project, PipelineStage } from '../models/project'
import type { ArtifactType, Artifact } from '../models/artifact'

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  research: 'Research',
  'data-model': 'Data Model',
  contracts: 'Contracts',
  security: 'Security Model',
  events: 'Domain Events',
  observability: 'Observability',
  deployment: 'Deployment',
  tasks: 'Tasks',
  quickstart: 'Quickstart',
}

const STATE_INDICATORS: Record<string, string> = {
  new: '\u25CB',
  'in-progress': '\u25D0',
  specified: '\u25CF',
}

export function renderSidebar(container: HTMLElement): void {
  function render(): void {
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    const state = getState()

    // App title with Dreamware logo
    const titleBlock = document.createElement('div')
    titleBlock.className = 'sidebar-title'
    titleBlock.style.marginBottom = 'var(--space-2)'

    const logo = document.createElement('img')
    logo.src = '/images/dreamware-logo.svg'
    logo.alt = 'Dreamware'
    logo.style.height = '28px'
    logo.style.opacity = '0.8'
    titleBlock.appendChild(logo)

    const subtitle = document.createElement('div')
    subtitle.style.fontSize = 'var(--text-xs)'
    subtitle.style.color = 'var(--color-text-secondary)'
    subtitle.style.marginTop = 'var(--space-1)'
    subtitle.style.letterSpacing = '0.03em'
    subtitle.textContent = 'Spec Workbench'
    titleBlock.appendChild(subtitle)

    container.appendChild(titleBlock)

    // --- Project list section ---
    const projectSection = document.createElement('div')
    projectSection.className = 'sidebar-project-list'
    projectSection.style.marginBottom = 'var(--space-3)'
    projectSection.style.borderBottom = '1px solid var(--color-border, #333)'
    projectSection.style.paddingBottom = 'var(--space-3)'

    const projectHeader = document.createElement('div')
    projectHeader.style.fontSize = 'var(--text-xs)'
    projectHeader.style.color = 'var(--color-text-secondary)'
    projectHeader.style.textTransform = 'uppercase'
    projectHeader.style.letterSpacing = '0.05em'
    projectHeader.style.marginBottom = 'var(--space-1)'
    projectHeader.textContent = 'Projects'
    projectSection.appendChild(projectHeader)

    // Project items
    for (const project of state.projects) {
      const item = createProjectItem(project, state.currentProjectId)
      projectSection.appendChild(item)
    }

    // New Project button / inline input
    const newProjectContainer = document.createElement('div')
    newProjectContainer.style.marginTop = 'var(--space-1)'
    renderNewProjectButton(newProjectContainer)
    projectSection.appendChild(newProjectContainer)

    container.appendChild(projectSection)

    // --- Features list (only if a project is selected) ---
    const currentProject = state.projects.find(p => p.id === state.currentProjectId)
    if (currentProject) {
      const featuresSection = document.createElement('div')
      featuresSection.className = 'sidebar-features-list'
      featuresSection.style.marginBottom = 'var(--space-3)'
      featuresSection.style.borderBottom = '1px solid var(--color-border, #333)'
      featuresSection.style.paddingBottom = 'var(--space-3)'

      const featuresHeader = document.createElement('div')
      featuresHeader.style.display = 'flex'
      featuresHeader.style.alignItems = 'center'
      featuresHeader.style.justifyContent = 'space-between'
      featuresHeader.style.marginBottom = 'var(--space-1)'

      const featuresLabel = document.createElement('div')
      featuresLabel.style.fontSize = 'var(--text-xs)'
      featuresLabel.style.color = 'var(--color-text-secondary)'
      featuresLabel.style.textTransform = 'uppercase'
      featuresLabel.style.letterSpacing = '0.05em'
      featuresLabel.textContent = 'Features'
      featuresHeader.appendChild(featuresLabel)

      // "+" button to add new feature
      const addFeatureBtn = document.createElement('button')
      addFeatureBtn.style.border = 'none'
      addFeatureBtn.style.background = 'none'
      addFeatureBtn.style.color = 'var(--color-text-secondary)'
      addFeatureBtn.style.cursor = 'pointer'
      addFeatureBtn.style.fontSize = 'var(--text-sm)'
      addFeatureBtn.style.padding = '0 var(--space-1)'
      addFeatureBtn.textContent = '+'
      addFeatureBtn.title = 'Add new feature'
      addFeatureBtn.setAttribute('aria-label', 'Add new feature spec')
      addFeatureBtn.addEventListener('click', () => {
        void createNewFeature()
      })
      featuresHeader.appendChild(addFeatureBtn)

      featuresSection.appendChild(featuresHeader)

      // Get all spec artifacts for the current project
      const specArtifacts = [...state.artifacts.values()].filter(
        a => a.projectId === state.currentProjectId && a.type === 'spec'
      )

      // Render each feature item
      for (const artifact of specArtifacts) {
        const featureItem = createFeatureItem(artifact, state.currentArtifactId)
        featuresSection.appendChild(featureItem)
      }

      container.appendChild(featuresSection)

      // --- Pipeline stages nav ---
      const nav = document.createElement('nav')
      nav.className = 'sidebar-nav'
      nav.setAttribute('role', 'list')
      nav.setAttribute('aria-label', 'Pipeline stages')

      const projectArtifacts = [...state.artifacts.values()].filter(a => a.projectId === currentProject.id)

      for (const stage of PIPELINE_STAGES) {
        const stageItem = createStageItem(stage, state.currentStage, projectArtifacts)
        nav.appendChild(stageItem)
      }

      container.appendChild(nav)
    }

    // Keyboard navigation
    container.addEventListener('keydown', handleKeyboard)
  }

  // --- Feature item ---
  function createFeatureItem(artifact: Artifact, currentArtifactId: string | null): HTMLElement {
    const item = document.createElement('div')
    item.className = 'sidebar-feature-item'
    item.style.display = 'flex'
    item.style.alignItems = 'center'
    item.style.padding = 'var(--space-1) var(--space-2)'
    item.style.cursor = 'pointer'
    item.style.borderRadius = 'var(--radius-sm, 4px)'
    item.style.fontSize = 'var(--text-sm)'
    item.style.gap = 'var(--space-2)'

    const isActive = artifact.id === currentArtifactId
    if (isActive) {
      item.style.background = 'var(--color-surface-hover, rgba(255,255,255,0.1))'
      item.style.fontWeight = '600'
    }

    // Feature name
    const featureName = deriveFeatureName(artifact.content)
    const nameSpan = document.createElement('span')
    nameSpan.style.flex = '1'
    nameSpan.style.overflow = 'hidden'
    nameSpan.style.textOverflow = 'ellipsis'
    nameSpan.style.whiteSpace = 'nowrap'
    nameSpan.textContent = featureName
    item.appendChild(nameSpan)

    // Coverage percentage badge
    const sections = parseMarkdownSections(artifact.content)
    const total = sections.length
    const filled = sections.filter(s => s.content.trim().length > 20).length
    const percent = total > 0 ? Math.round((filled / total) * 100) : 0

    const badge = document.createElement('span')
    badge.style.fontSize = 'var(--text-xs)'
    badge.style.color = 'var(--color-text-secondary)'
    badge.style.flexShrink = '0'
    badge.textContent = `${percent}%`
    item.appendChild(badge)

    // Click to switch feature
    item.addEventListener('click', async () => {
      if (artifact.id === currentArtifactId) return
      await flushAll()
      setState({ currentArtifactId: artifact.id })
      // Load conversation for this feature
      await switchChatToFeature(artifact.id)
    })

    return item
  }

  // --- Create new feature ---
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

    // Switch chat to the new feature
    await switchChatToFeature(artifact.id)

    addToast('New feature spec created', 'success')
  }

  // --- Project item ---
  function createProjectItem(project: Project, currentProjectId: string | null): HTMLElement {
    const item = document.createElement('div')
    item.className = 'sidebar-project-item'
    item.style.display = 'flex'
    item.style.alignItems = 'center'
    item.style.padding = 'var(--space-1) var(--space-2)'
    item.style.cursor = 'pointer'
    item.style.borderRadius = 'var(--radius-sm, 4px)'
    item.style.fontSize = 'var(--text-sm)'
    item.style.position = 'relative'

    const isActive = project.id === currentProjectId
    if (isActive) {
      item.style.background = 'var(--color-surface-hover, rgba(255,255,255,0.1))'
      item.style.fontWeight = '600'
    }

    // State indicator
    const indicator = document.createElement('span')
    indicator.style.marginRight = 'var(--space-2)'
    indicator.style.fontSize = 'var(--text-xs)'
    indicator.style.flexShrink = '0'
    indicator.textContent = STATE_INDICATORS[project.state] || '\u25CB'
    item.appendChild(indicator)

    // Project name (double-click to rename)
    const nameSpan = document.createElement('span')
    nameSpan.className = 'sidebar-project-name'
    nameSpan.style.flex = '1'
    nameSpan.style.overflow = 'hidden'
    nameSpan.style.textOverflow = 'ellipsis'
    nameSpan.style.whiteSpace = 'nowrap'
    nameSpan.textContent = project.name
    item.appendChild(nameSpan)

    // Delete button (visible on hover)
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'sidebar-project-delete'
    deleteBtn.textContent = '\u00d7'
    deleteBtn.title = `Delete ${project.name}`
    deleteBtn.setAttribute('aria-label', `Delete ${project.name}`)
    deleteBtn.style.border = 'none'
    deleteBtn.style.background = 'none'
    deleteBtn.style.color = 'var(--color-text-secondary)'
    deleteBtn.style.cursor = 'pointer'
    deleteBtn.style.fontSize = 'var(--text-sm)'
    deleteBtn.style.padding = '0 var(--space-1)'
    deleteBtn.style.opacity = '0'
    deleteBtn.style.transition = 'opacity 0.15s'
    deleteBtn.style.flexShrink = '0'
    item.appendChild(deleteBtn)

    // Show delete button on hover
    item.addEventListener('mouseenter', () => { deleteBtn.style.opacity = '1' })
    item.addEventListener('mouseleave', () => { deleteBtn.style.opacity = '0' })

    // Switch project on click
    item.addEventListener('click', async (e) => {
      if ((e.target as HTMLElement).closest('.sidebar-project-delete')) return
      if (project.id === currentProjectId) return
      await switchToProject(project.id)
    })

    // Double-click to rename
    nameSpan.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      enterRenameMode(item, nameSpan, project)
    })

    // Delete on click
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation()
      await handleDeleteProject(project)
    })

    return item
  }

  // --- New Project button ---
  function renderNewProjectButton(container: HTMLElement): void {
    while (container.firstChild) container.removeChild(container.firstChild)

    const btn = document.createElement('button')
    btn.className = 'sidebar-new-project-btn'
    btn.textContent = '+ New Project'
    btn.style.width = '100%'
    btn.style.border = '1px dashed var(--color-border, #555)'
    btn.style.background = 'none'
    btn.style.color = 'var(--color-text-secondary)'
    btn.style.cursor = 'pointer'
    btn.style.padding = 'var(--space-1) var(--space-2)'
    btn.style.borderRadius = 'var(--radius-sm, 4px)'
    btn.style.fontSize = 'var(--text-sm)'
    btn.style.textAlign = 'left'

    btn.addEventListener('click', () => {
      renderNewProjectInput(container)
    })

    container.appendChild(btn)
  }

  // --- Inline input for new project name ---
  function renderNewProjectInput(container: HTMLElement): void {
    while (container.firstChild) container.removeChild(container.firstChild)

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Project name...'
    input.style.width = '100%'
    input.style.padding = 'var(--space-1) var(--space-2)'
    input.style.border = '1px solid var(--color-accent, #4a9eff)'
    input.style.borderRadius = 'var(--radius-sm, 4px)'
    input.style.background = 'var(--color-surface, #1e1e1e)'
    input.style.color = 'var(--color-text, #fff)'
    input.style.fontSize = 'var(--text-sm)'
    input.style.outline = 'none'
    input.style.boxSizing = 'border-box'

    let committed = false

    async function commit(): Promise<void> {
      if (committed) return
      committed = true
      const name = input.value.trim()
      if (!name) {
        renderNewProjectButton(container)
        return
      }
      await handleCreateProject(name)
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void commit()
      } else if (e.key === 'Escape') {
        committed = true
        renderNewProjectButton(container)
      }
    })

    input.addEventListener('blur', () => {
      void commit()
    })

    container.appendChild(input)
    input.focus()
  }

  // --- Create project handler ---
  async function handleCreateProject(name: string): Promise<void> {
    const project = createProject(name)
    await createProjectInDB(project)

    // Create default spec artifact with scaffold
    const content = scaffoldArtifact('spec')
    const artifact = createArtifact(project.id, 'spec', 'specify', content)
    await createArtifactInDB(artifact)

    const state = getState()
    const artifacts = new Map(state.artifacts)
    artifacts.set(artifact.id, artifact)

    setState({
      projects: [...state.projects, project],
      artifacts,
      currentProjectId: project.id,
      currentStage: project.currentStage,
      currentArtifactId: artifact.id,
    })

    addToast(`Created project "${name}"`, 'success')
  }

  // --- Switch project handler ---
  async function switchToProject(projectId: string): Promise<void> {
    await flushAll()

    const projectArtifacts = await getArtifactsByProject(projectId)
    const state = getState()
    const artifacts = new Map(state.artifacts)

    // Ensure artifacts for this project are loaded
    for (const a of projectArtifacts) {
      artifacts.set(a.id, a)
    }

    const project = state.projects.find(p => p.id === projectId)
    const firstSpecArtifact = projectArtifacts.find(a => a.type === 'spec') || projectArtifacts[0] || null

    setState({
      artifacts,
      currentProjectId: projectId,
      currentStage: project?.currentStage || 'specify',
      currentArtifactId: firstSpecArtifact?.id || null,
    })

    // Load conversation for the selected artifact
    if (firstSpecArtifact) {
      await switchChatToFeature(firstSpecArtifact.id)
    }
  }

  // --- Delete project handler ---
  async function handleDeleteProject(project: Project): Promise<void> {
    const confirmed = window.confirm(`Delete "${project.name}"?`)
    if (!confirmed) return

    await deleteProjectFromDB(project.id)

    const state = getState()
    const newProjects = state.projects.filter(p => p.id !== project.id)

    // Remove artifacts belonging to this project from state
    const artifacts = new Map(state.artifacts)
    for (const [id, a] of artifacts) {
      if (a.projectId === project.id) {
        artifacts.delete(id)
      }
    }

    // If deleted project was current, switch to another or clear
    let newCurrentProjectId = state.currentProjectId
    let newCurrentArtifactId = state.currentArtifactId
    let newCurrentStage: PipelineStage = state.currentStage

    if (state.currentProjectId === project.id) {
      if (newProjects.length > 0) {
        const nextProject = newProjects[newProjects.length - 1]
        newCurrentProjectId = nextProject.id
        newCurrentStage = nextProject.currentStage
        const nextArtifacts = [...artifacts.values()].filter(a => a.projectId === nextProject.id)
        newCurrentArtifactId = nextArtifacts[0]?.id || null
      } else {
        newCurrentProjectId = null
        newCurrentArtifactId = null
        newCurrentStage = 'specify'
      }
    }

    setState({
      projects: newProjects,
      artifacts,
      currentProjectId: newCurrentProjectId,
      currentArtifactId: newCurrentArtifactId,
      currentStage: newCurrentStage,
    })

    addToast(`Deleted project "${project.name}"`, 'info')
  }

  // --- Rename project (inline edit) ---
  function enterRenameMode(_item: HTMLElement, nameSpan: HTMLElement, project: Project): void {
    const input = document.createElement('input')
    input.type = 'text'
    input.value = project.name
    input.style.flex = '1'
    input.style.padding = '0 var(--space-1)'
    input.style.border = '1px solid var(--color-accent, #4a9eff)'
    input.style.borderRadius = 'var(--radius-sm, 4px)'
    input.style.background = 'var(--color-surface, #1e1e1e)'
    input.style.color = 'var(--color-text, #fff)'
    input.style.fontSize = 'var(--text-sm)'
    input.style.outline = 'none'
    input.style.minWidth = '0'

    nameSpan.replaceWith(input)
    input.focus()
    input.select()

    let committed = false

    async function commit(): Promise<void> {
      if (committed) return
      committed = true
      const newName = input.value.trim()
      if (newName && newName !== project.name) {
        project.name = newName
        await updateProjectInDB(project)
        const state = getState()
        const updatedProjects = state.projects.map(p => p.id === project.id ? { ...p, name: newName } : p)
        setState({ projects: updatedProjects })
      } else {
        // Cancel or no change — just re-render
        input.replaceWith(nameSpan)
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void commit()
      } else if (e.key === 'Escape') {
        committed = true
        input.replaceWith(nameSpan)
      }
    })

    input.addEventListener('blur', () => {
      void commit()
    })
  }

  function createStageItem(
    stage: PipelineStage,
    activeStage: PipelineStage,
    projectArtifacts: Artifact[],
  ): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('role', 'listitem')

    // Stage header button
    const btn = document.createElement('button')
    btn.className = `pipeline-stage${stage === activeStage ? ' active' : ''}`
    btn.setAttribute('data-stage', stage)
    btn.style.width = '100%'
    btn.style.border = 'none'
    btn.style.background = 'none'
    btn.style.font = 'inherit'
    btn.style.textAlign = 'left'

    // Completion indicator
    const completion = getStageCompletion(projectArtifacts, stage)
    const dot = document.createElement('span')
    dot.className = 'pipeline-dot'
    dot.setAttribute('role', 'img')
    if (completion.completed === completion.total && completion.total > 0) {
      dot.classList.add('pipeline-dot--complete')
      dot.setAttribute('aria-label', 'Complete')
      dot.setAttribute('title', 'Complete')
    } else if (completion.inProgress > 0 || completion.completed > 0) {
      dot.classList.add('pipeline-dot--partial')
      dot.setAttribute('aria-label', 'In progress')
      dot.setAttribute('title', 'In progress')
    } else {
      dot.classList.add('pipeline-dot--none')
      dot.setAttribute('aria-label', 'Not started')
      dot.setAttribute('title', 'Not started')
    }
    btn.appendChild(dot)

    // Stage name
    const name = document.createElement('span')
    name.style.flex = '1'
    name.textContent = stage.charAt(0).toUpperCase() + stage.slice(1)
    btn.appendChild(name)

    // Artifact count badge
    const stageArtifacts = projectArtifacts.filter(a => a.stage === stage)
    const count = document.createElement('span')
    count.style.fontSize = 'var(--text-xs)'
    count.style.color = 'var(--color-text-secondary)'
    count.textContent = `${stageArtifacts.length}`
    btn.appendChild(count)

    btn.addEventListener('click', async () => {
      await flushAll() // INV-003: force-save before navigation
      setState({ currentStage: stage })
      // Select first artifact of the stage if available
      const firstArtifact = stageArtifacts[0]
      if (firstArtifact) {
        setState({ currentArtifactId: firstArtifact.id })
      } else {
        setState({ currentArtifactId: null })
      }
    })

    wrapper.appendChild(btn)

    // Artifact types under stage
    if (stage === activeStage) {
      const artifactTypes = STAGE_ARTIFACT_MAP[stage]
      const typeList = document.createElement('div')
      typeList.className = 'sidebar-artifact-types'
      typeList.style.paddingLeft = 'var(--space-6)'
      typeList.style.marginTop = 'var(--space-1)'
      typeList.style.marginBottom = 'var(--space-2)'

      for (const artifactType of artifactTypes) {
        const typeBtn = createArtifactTypeItem(artifactType, stage, stageArtifacts)
        typeList.appendChild(typeBtn)
      }

      wrapper.appendChild(typeList)
    }

    return wrapper
  }

  function createArtifactTypeItem(
    type: ArtifactType,
    stage: PipelineStage,
    stageArtifacts: Artifact[],
  ): HTMLElement {
    const state = getState()
    const artifact = stageArtifacts.find(a => a.type === type)

    const btn = document.createElement('button')
    btn.className = 'pipeline-stage'
    btn.setAttribute('data-artifact-type', type)
    btn.style.width = '100%'
    btn.style.border = 'none'
    btn.style.background = 'none'
    btn.style.font = 'inherit'
    btn.style.textAlign = 'left'
    btn.style.fontSize = 'var(--text-sm)'
    btn.style.padding = 'var(--space-1) var(--space-3)'

    if (artifact && artifact.id === state.currentArtifactId) {
      btn.classList.add('active')
    }

    // State indicator
    const indicator = document.createElement('span')
    indicator.className = 'section-card-indicator'
    if (!artifact) {
      indicator.classList.add('section-card-indicator--empty')
    } else if (artifact.state === 'complete') {
      indicator.classList.add('section-card-indicator--complete')
    } else if (artifact.state === 'draft') {
      indicator.classList.add('section-card-indicator--draft')
    } else {
      indicator.classList.add('section-card-indicator--empty')
    }
    btn.appendChild(indicator)

    const label = document.createElement('span')
    label.style.flex = '1'
    label.textContent = ARTIFACT_TYPE_LABELS[type] || type
    btn.appendChild(label)

    btn.addEventListener('click', async () => {
      await flushAll() // INV-003: force-save before navigation
      if (artifact) {
        setState({ currentArtifactId: artifact.id })
      } else {
        // Create artifact from template
        await createArtifactFromTemplate(type, stage)
      }
    })

    return btn
  }

  async function createArtifactFromTemplate(type: ArtifactType, stage: PipelineStage): Promise<void> {
    const state = getState()
    if (!state.currentProjectId) return

    const content = scaffoldArtifact(type)
    const artifact = createArtifact(state.currentProjectId, type, stage, content)

    // Save to DB
    await createArtifactInDB(artifact)

    // Add to state
    const artifacts = new Map(state.artifacts)
    artifacts.set(artifact.id, artifact)
    setState({
      artifacts,
      currentArtifactId: artifact.id,
    })

    addToast(`Created ${ARTIFACT_TYPE_LABELS[type] || type}`, 'success')
  }

  function handleKeyboard(e: KeyboardEvent): void {
    const state = getState()
    const currentIndex = PIPELINE_STAGES.indexOf(state.currentStage)

    if (e.key === 'ArrowDown' && currentIndex < PIPELINE_STAGES.length - 1) {
      e.preventDefault()
      const nextStage = PIPELINE_STAGES[currentIndex + 1]
      void flushAll().then(() => {
        setState({ currentStage: nextStage })
        // Focus the new stage button
        const nextBtn = container.querySelector(`[data-stage="${nextStage}"]`) as HTMLElement
        nextBtn?.focus()
      })
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault()
      const prevStage = PIPELINE_STAGES[currentIndex - 1]
      void flushAll().then(() => {
        setState({ currentStage: prevStage })
        const prevBtn = container.querySelector(`[data-stage="${prevStage}"]`) as HTMLElement
        prevBtn?.focus()
      })
    } else if (e.key === 'Enter') {
      // Enter activates the focused stage
      const focused = document.activeElement as HTMLElement
      focused?.click()
    }
  }

  // Subscribe to state changes to re-render
  subscribe(() => {
    render()
  })

  render()
}
