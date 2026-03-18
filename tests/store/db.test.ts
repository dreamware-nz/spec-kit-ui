import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  createProjectInDB,
  getProject,
  getAllProjects,
  updateProject,
  deleteProject,
  createArtifactInDB,
  getArtifact,
  getArtifactsByProject,
  getArtifactByProjectAndType,
  updateArtifact,
  deleteArtifact,
  clearDB,
  closeDB,
} from '../../src/store/db'
import { createProject } from '../../src/models/project'
import { createArtifact } from '../../src/models/artifact'

beforeEach(async () => {
  await clearDB()
})

afterEach(() => {
  closeDB()
})

describe('Project CRUD', () => {
  it('creates and retrieves a project', async () => {
    const project = createProject('Test Project')
    await createProjectInDB(project)
    const retrieved = await getProject(project.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('Test Project')
  })

  it('lists all projects sorted by updated', async () => {
    const p1 = createProject('First')
    const p2 = createProject('Second')
    await createProjectInDB(p1)
    await createProjectInDB(p2)
    const all = await getAllProjects()
    expect(all).toHaveLength(2)
  })

  it('updates a project', async () => {
    const project = createProject('Original')
    await createProjectInDB(project)
    project.name = 'Updated'
    await updateProject(project)
    const retrieved = await getProject(project.id)
    expect(retrieved!.name).toBe('Updated')
  })

  it('deletes a project and its artifacts', async () => {
    const project = createProject('ToDelete')
    await createProjectInDB(project)
    const artifact = createArtifact(project.id, 'spec', 'specify', 'content')
    await createArtifactInDB(artifact)
    await deleteProject(project.id)
    expect(await getProject(project.id)).toBeUndefined()
    expect(await getArtifactsByProject(project.id)).toHaveLength(0)
  })
})

describe('Artifact CRUD', () => {
  it('creates and retrieves an artifact', async () => {
    const artifact = createArtifact('p1', 'spec', 'specify', '# Spec')
    await createArtifactInDB(artifact)
    const retrieved = await getArtifact(artifact.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.content).toBe('# Spec')
  })

  it('queries artifacts by project', async () => {
    await createArtifactInDB(createArtifact('p1', 'spec', 'specify'))
    await createArtifactInDB(createArtifact('p1', 'plan', 'plan'))
    await createArtifactInDB(createArtifact('p2', 'spec', 'specify'))
    const p1Artifacts = await getArtifactsByProject('p1')
    expect(p1Artifacts).toHaveLength(2)
  })

  it('queries by project and type compound index', async () => {
    await createArtifactInDB(createArtifact('p1', 'spec', 'specify', 'spec content'))
    await createArtifactInDB(createArtifact('p1', 'plan', 'plan', 'plan content'))
    const spec = await getArtifactByProjectAndType('p1', 'spec')
    expect(spec).toBeDefined()
    expect(spec!.type).toBe('spec')
  })

  it('updates an artifact', async () => {
    const artifact = createArtifact('p1', 'spec', 'specify', 'old')
    await createArtifactInDB(artifact)
    artifact.content = 'new'
    await updateArtifact(artifact)
    const retrieved = await getArtifact(artifact.id)
    expect(retrieved!.content).toBe('new')
  })

  it('deletes an artifact', async () => {
    const artifact = createArtifact('p1', 'spec', 'specify')
    await createArtifactInDB(artifact)
    await deleteArtifact(artifact.id)
    expect(await getArtifact(artifact.id)).toBeUndefined()
  })
})
