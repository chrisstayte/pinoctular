const DB_NAME = 'pinoctular-sessions'
const DB_VERSION = 1
const STORE_NAME = 'sessions'

interface StoredSession {
  id: string
  name: string
  createdAt: number
  data: Uint8Array
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveSession(
  id: string,
  name: string,
  data: Uint8Array,
  createdAt: number
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const record: StoredSession = { id, name, createdAt, data }
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export async function loadSession(id: string): Promise<StoredSession | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export interface SessionInfo {
  id: string
  name: string
  createdAt: number
  sizeBytes: number
}

export async function listSessions(): Promise<SessionInfo[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const records = request.result as StoredSession[]
      resolve(
        records.map((r) => ({
          id: r.id,
          name: r.name,
          createdAt: r.createdAt,
          sizeBytes: r.data.byteLength,
        }))
      )
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export async function getStorageEstimate(): Promise<{
  usage: number
  quota: number
}> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    }
  }
  return { usage: 0, quota: 0 }
}
