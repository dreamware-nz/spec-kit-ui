import { openDB, type IDBPDatabase } from 'idb'
import type { Project } from '../models/project'
import type { Artifact } from '../models/artifact'
import type { Conversation } from '../models/conversation'

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
  conversations: {
    key: string
    value: Conversation
    indexes: {
      'by-project': string
      'by-artifact': string
    }
  }
}

let dbInstance: IDBPDatabase<SpecWorkbenchDB> | null = null

export async function getDB(): Promise<IDBPDatabase<SpecWorkbenchDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<SpecWorkbenchDB>('spec-workbench', 3, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' })
        projectStore.createIndex('by-updated', 'updatedAt')
        projectStore.createIndex('by-name', 'name')

        const artifactStore = db.createObjectStore('artifacts', { keyPath: 'id' })
        artifactStore.createIndex('by-project', 'projectId')
        artifactStore.createIndex('by-project-type', ['projectId', 'type'])
        artifactStore.createIndex('by-updated', 'updatedAt')
      }

      if (oldVersion < 2) {
        const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' })
        conversationStore.createIndex('by-project', 'projectId')
      }

      if (oldVersion < 3) {
        // Add by-artifact index to conversations store
        const store = transaction.objectStore('conversations')
        if (!store.indexNames.contains('by-artifact')) {
          store.createIndex('by-artifact', 'artifactId')
        }
      }
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
  // Also delete all conversations for this project
  await deleteConversationsByProject(id)
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

// Conversation CRUD
export async function getConversationByProject(projectId: string): Promise<Conversation | undefined> {
  const db = await getDB()
  const conversations = await db.getAllFromIndex('conversations', 'by-project', projectId)
  // Return the most recent conversation for this project
  if (conversations.length === 0) return undefined
  return conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

export async function getConversationByArtifact(artifactId: string): Promise<Conversation | undefined> {
  const db = await getDB()
  const conversations = await db.getAllFromIndex('conversations', 'by-artifact', artifactId)
  if (conversations.length === 0) return undefined
  return conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

export async function getConversationsByProject(projectId: string): Promise<Conversation[]> {
  const db = await getDB()
  return db.getAllFromIndex('conversations', 'by-project', projectId)
}

export async function saveConversation(conversation: Conversation): Promise<Conversation> {
  const db = await getDB()
  conversation.updatedAt = new Date().toISOString()
  await db.put('conversations', conversation)
  return conversation
}

export async function deleteConversationsByProject(projectId: string): Promise<void> {
  const db = await getDB()
  const conversations = await db.getAllFromIndex('conversations', 'by-project', projectId)
  const tx = db.transaction('conversations', 'readwrite')
  for (const c of conversations) {
    await tx.store.delete(c.id)
  }
  await tx.done
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
  const tx3 = db.transaction('conversations', 'readwrite')
  await tx3.store.clear()
  await tx3.done
}

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
