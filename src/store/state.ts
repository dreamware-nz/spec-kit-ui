import type { Project } from '../models/project'
import type { Artifact } from '../models/artifact'
import type { PipelineStage } from '../models/project'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  createdAt: number
}

export interface AppState {
  currentProjectId: string | null
  currentStage: PipelineStage
  currentArtifactId: string | null
  projects: Project[]
  artifacts: Map<string, Artifact>
  toasts: Toast[]
}

type Listener = (state: AppState) => void

const listeners: Set<Listener> = new Set()

const state: AppState = {
  currentProjectId: null,
  currentStage: 'specify',
  currentArtifactId: null,
  projects: [],
  artifacts: new Map(),
  toasts: [],
}

export function getState(): AppState {
  return state
}

export function setState(partial: Partial<AppState>): void {
  Object.assign(state, partial)
  notify()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  for (const listener of listeners) {
    listener(state)
  }
}

export function addToast(message: string, type: Toast['type'] = 'info'): void {
  const toast: Toast = {
    id: crypto.randomUUID(),
    message,
    type,
    createdAt: Date.now(),
  }
  state.toasts.push(toast)
  notify()
  setTimeout(() => {
    state.toasts = state.toasts.filter(t => t.id !== toast.id)
    notify()
  }, 3000)
}
