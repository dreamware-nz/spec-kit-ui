import type { PipelineStage } from './project'
import type { Artifact, ArtifactType, ArtifactState } from './artifact'
import { STAGE_ARTIFACT_MAP } from './artifact'

export const PIPELINE_STAGES: PipelineStage[] = ['specify', 'clarify', 'plan', 'tasks']

export interface StageCompletion {
  total: number
  completed: number
  inProgress: number
}

export function getStageCompletion(artifacts: Artifact[], stage: PipelineStage): StageCompletion {
  const expected: ArtifactType[] = STAGE_ARTIFACT_MAP[stage]
  const stageArtifacts = artifacts.filter(a => a.stage === stage)

  return {
    total: expected.length,
    completed: stageArtifacts.filter(a => a.state === 'complete').length,
    inProgress: stageArtifacts.filter(a => a.state === 'draft').length,
  }
}

export function deriveArtifactState(content: string, type: ArtifactType): ArtifactState {
  if (!content || content.trim().length === 0) return 'empty'
  // A spec is "complete" when it has user stories AND requirements AND success criteria
  if (type === 'spec') {
    const hasStories = /## User Scenarios/i.test(content)
    const hasRequirements = /## Requirements/i.test(content)
    const hasCriteria = /## Success Criteria/i.test(content)
    if (hasStories && hasRequirements && hasCriteria) return 'complete'
  }
  // Other artifacts are complete when they have content beyond just template headings
  if (type !== 'spec') {
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('<!--'))
    if (lines.length > 5) return 'complete'
  }
  return 'draft'
}

export function deriveProjectState(artifacts: Artifact[]): 'new' | 'in-progress' | 'specified' {
  if (artifacts.length === 0 || artifacts.every(a => a.state === 'empty')) return 'new'
  const spec = artifacts.find(a => a.type === 'spec')
  if (spec && spec.state === 'complete') return 'specified'
  return 'in-progress'
}
