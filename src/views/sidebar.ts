import { getState, setState, subscribe, addToast } from '../store/state'
import { flushAll } from '../store/sync'
import { PIPELINE_STAGES, getStageCompletion } from '../models/pipeline'
import { STAGE_ARTIFACT_MAP, createArtifact } from '../models/artifact'
import { createArtifactInDB } from '../store/db'
import { scaffoldArtifact } from '../parsers/template'
import type { PipelineStage } from '../models/project'
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

export function renderSidebar(container: HTMLElement): void {
  function render(): void {
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    const state = getState()

    // App title
    const title = document.createElement('div')
    title.className = 'sidebar-title'
    title.style.fontWeight = '600'
    title.style.fontSize = 'var(--text-lg)'
    title.textContent = 'Spec Workbench'
    container.appendChild(title)

    // Current project name
    const currentProject = state.projects.find(p => p.id === state.currentProjectId)
    const projectName = document.createElement('div')
    projectName.className = 'sidebar-project-name'
    projectName.style.fontSize = 'var(--text-sm)'
    projectName.style.color = 'var(--color-text-secondary)'
    projectName.style.marginBottom = 'var(--space-2)'
    projectName.textContent = currentProject ? currentProject.name : 'No project selected'
    container.appendChild(projectName)

    // Pipeline stages nav
    const nav = document.createElement('nav')
    nav.className = 'sidebar-nav'
    nav.setAttribute('role', 'list')
    nav.setAttribute('aria-label', 'Pipeline stages')

    const projectArtifacts = currentProject
      ? [...state.artifacts.values()].filter(a => a.projectId === currentProject.id)
      : []

    for (const stage of PIPELINE_STAGES) {
      const stageItem = createStageItem(stage, state.currentStage, projectArtifacts)
      nav.appendChild(stageItem)
    }

    container.appendChild(nav)

    // Keyboard navigation
    container.addEventListener('keydown', handleKeyboard)
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
    if (completion.completed === completion.total && completion.total > 0) {
      dot.classList.add('pipeline-dot--complete')
    } else if (completion.inProgress > 0 || completion.completed > 0) {
      dot.classList.add('pipeline-dot--partial')
    } else {
      dot.classList.add('pipeline-dot--none')
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

    // Artifact types under stage (T035)
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
        // T038: Create artifact from template
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
