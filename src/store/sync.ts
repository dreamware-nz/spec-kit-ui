import { updateArtifact as updateArtifactInDB } from './db'
import { getState, addToast } from './state'

const dirtyArtifacts = new Set<string>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_INTERVAL = 5000 // 5 seconds max per INV-003

export function markDirty(artifactId: string): void {
  dirtyArtifacts.add(artifactId)
  scheduleSave()
}

function scheduleSave(): void {
  if (saveTimer) return // already scheduled
  saveTimer = setTimeout(async () => {
    saveTimer = null
    await flush()
  }, SAVE_INTERVAL)
}

async function flush(): Promise<void> {
  const state = getState()
  const toSave = [...dirtyArtifacts]
  dirtyArtifacts.clear()

  for (const id of toSave) {
    const artifact = state.artifacts.get(id)
    if (artifact) {
      try {
        await updateArtifactInDB(artifact)
      } catch (err) {
        console.error('Auto-save failed for artifact', id, err)
        dirtyArtifacts.add(id) // retry next cycle
      }
    }
  }
}

export async function flushAll(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await flush()
}

export function startAutoSave(): void {
  // Check storage quota on init
  checkStorageQuota()
}

export function stopAutoSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

async function checkStorageQuota(): Promise<void> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate()
      if (estimate.quota && estimate.usage) {
        const usagePercent = (estimate.usage / estimate.quota) * 100
        if (usagePercent > 80) {
          addToast(`Storage is ${usagePercent.toFixed(0)}% full. Consider exporting your specs.`, 'info')
        }
      }
    } catch {
      // Silently ignore — not critical
    }
  }
}
