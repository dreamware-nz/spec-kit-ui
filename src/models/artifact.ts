import type { PipelineStage } from './project'

export type ArtifactType =
  | 'spec' | 'plan' | 'research' | 'data-model' | 'contracts'
  | 'security' | 'events' | 'observability' | 'deployment'
  | 'tasks' | 'quickstart'

export type ArtifactState = 'empty' | 'draft' | 'complete'

export interface Section {
  headingLevel: number
  title: string
  content: string
  structuredData: Invariant[] | EntityLifecycle | SystemBehavior[] | null
  collapsed: boolean
}

export interface Invariant {
  id: string
  rule: string
  scope: string
  violationConsequence: string
}

export interface LifecycleTransition {
  from: string
  to: string
  trigger: string
  guardCondition: string
}

export interface EntityLifecycle {
  entityName: string
  states: string[]
  transitions: LifecycleTransition[]
  terminalStates: string[]
  reEntryRules: string
}

export interface SystemBehavior {
  id: string
  trigger: string
  action: string
  triggerType: 'user-action' | 'time-based' | 'external-event' | 'state-change' | 'threshold-breach'
  failureHandling: string
}

export interface Artifact {
  id: string
  projectId: string
  type: ArtifactType
  stage: PipelineStage
  content: string
  sections: Section[]
  state: ArtifactState
  updatedAt: string
}

export const STAGE_ARTIFACT_MAP: Record<PipelineStage, ArtifactType[]> = {
  specify: ['spec'],
  clarify: ['spec'],
  plan: ['plan', 'research', 'data-model', 'contracts', 'security', 'events', 'observability', 'deployment'],
  tasks: ['tasks', 'quickstart'],
}

export function createArtifact(
  projectId: string,
  type: ArtifactType,
  stage: PipelineStage,
  content = '',
): Artifact {
  return {
    id: crypto.randomUUID(),
    projectId,
    type,
    stage,
    content,
    sections: [],
    state: content ? 'draft' : 'empty',
    updatedAt: new Date().toISOString(),
  }
}
