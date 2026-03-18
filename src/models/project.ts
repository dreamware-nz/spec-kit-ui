export type ProjectState = 'new' | 'in-progress' | 'specified'
export type PipelineStage = 'specify' | 'clarify' | 'plan' | 'tasks'

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  currentStage: PipelineStage
  state: ProjectState
}

export function createProject(name: string): Project {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    currentStage: 'specify',
    state: 'new',
  }
}
