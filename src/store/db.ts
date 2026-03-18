import { openDB, type IDBPDatabase } from 'idb'
import type { Project } from '../models/project'
import type { Artifact } from '../models/artifact'

interface SpecWorkbenchDB {
  projects: {
    key: string
    value: Project
    indexes: {
      'by-updated': string
      'by-name': string
    }
  }
  artifacts: {
    key: string
    value: Artifact
    indexes: {
      'by-project': string
      'by-project-type': [string, string]
      'by-updated': string
    }
  }
}

let dbInstance: IDBPDatabase<SpecWorkbenchDB> | null = null

export async function getDB(): Promise<IDBPDatabase<SpecWorkbenchDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<SpecWorkbenchDB>('spec-workbench', 1, {
    upgrade(db) {
      const projectStore = db.createObjectStore('projects', { keyPath: 'id' })
      projectStore.createIndex('by-updated', 'updatedAt')
      projectStore.createIndex('by-name', 'name')

      const artifactStore = db.createObjectStore('artifacts', { keyPath: 'id' })
      artifactStore.createIndex('by-project', 'projectId')
      artifactStore.createIndex('by-project-type', ['projectId', 'type'])
      artifactStore.createIndex('by-updated', 'updatedAt')
    },
  })
  return dbInstance
}

// Project CRUD
export async function createProjectInDB(project: Project): Promise<Project> {
  const db = await getDB()
  await db.put('projects', project)
  return project
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  return db.get('projects', id)
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB()
  return db.getAllFromIndex('projects', 'by-updated')
}

export async function updateProject(project: Project): Promise<Project> {
  const db = await getDB()
  project.updatedAt = new Date().toISOString()
  await db.put('projects', project)
  return project
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('projects', id)
  // Also delete all artifacts for this project
  const artifacts = await getArtifactsByProject(id)
  const tx = db.transaction('artifacts', 'readwrite')
  for (const a of artifacts) {
    await tx.store.delete(a.id)
  }
  await tx.done
}

// Artifact CRUD
export async function createArtifactInDB(artifact: Artifact): Promise<Artifact> {
  const db = await getDB()
  await db.put('artifacts', artifact)
  return artifact
}

export async function getArtifact(id: string): Promise<Artifact | undefined> {
  const db = await getDB()
  return db.get('artifacts', id)
}

export async function getArtifactsByProject(projectId: string): Promise<Artifact[]> {
  const db = await getDB()
  return db.getAllFromIndex('artifacts', 'by-project', projectId)
}

export async function getArtifactByProjectAndType(projectId: string, type: string): Promise<Artifact | undefined> {
  const db = await getDB()
  return db.getFromIndex('artifacts', 'by-project-type', [projectId, type])
}

export async function updateArtifact(artifact: Artifact): Promise<Artifact> {
  const db = await getDB()
  artifact.updatedAt = new Date().toISOString()
  await db.put('artifacts', artifact)
  return artifact
}

export async function deleteArtifact(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('artifacts', id)
}

// For testing: close and clear
export async function clearDB(): Promise<void> {
  const db = await getDB()
  const tx1 = db.transaction('projects', 'readwrite')
  await tx1.store.clear()
  await tx1.done
  const tx2 = db.transaction('artifacts', 'readwrite')
  await tx2.store.clear()
  await tx2.done
}

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
