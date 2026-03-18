import { describe, it, expect } from 'vitest'
import { getStageCompletion, deriveArtifactState, deriveProjectState } from '../../src/models/pipeline'
import { createArtifact } from '../../src/models/artifact'

describe('deriveArtifactState', () => {
  it('returns empty for no content', () => {
    expect(deriveArtifactState('', 'spec')).toBe('empty')
    expect(deriveArtifactState('  ', 'plan')).toBe('empty')
  })

  it('returns draft for partial spec', () => {
    expect(deriveArtifactState('## User Scenarios\n\nSome content', 'spec')).toBe('draft')
  })

  it('returns complete for full spec', () => {
    const content = '## User Scenarios\n\nStories\n\n## Requirements\n\nReqs\n\n## Success Criteria\n\nCriteria'
    expect(deriveArtifactState(content, 'spec')).toBe('complete')
  })

  it('returns draft for short non-spec content', () => {
    expect(deriveArtifactState('# Plan\n\nShort', 'plan')).toBe('draft')
  })
})

describe('deriveProjectState', () => {
  it('returns new for empty artifacts', () => {
    expect(deriveProjectState([])).toBe('new')
  })

  it('returns in-progress for draft artifacts', () => {
    const artifact = { ...createArtifact('p1', 'spec', 'specify', 'some content'), state: 'draft' as const }
    expect(deriveProjectState([artifact])).toBe('in-progress')
  })

  it('returns specified when spec is complete', () => {
    const artifact = { ...createArtifact('p1', 'spec', 'specify', 'content'), state: 'complete' as const }
    expect(deriveProjectState([artifact])).toBe('specified')
  })
})

describe('getStageCompletion', () => {
  it('counts completed artifacts for a stage', () => {
    const artifacts = [
      { ...createArtifact('p1', 'spec', 'specify'), state: 'complete' as const },
    ]
    const result = getStageCompletion(artifacts, 'specify')
    expect(result.completed).toBe(1)
    expect(result.total).toBe(1)
  })
})
