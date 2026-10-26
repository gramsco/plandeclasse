import type { Storage } from './storage'

const DB_NAME = 'plandeclasse'
type StoreName = 'classes' | 'rooms' | 'plans' | 'photos' | 'meta'

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

/**
 * Migrations of the database STRUCTURE (object stores). Entry `i` migrates from version `i` to
 * `i + 1`. Never edit an existing step: add a new one (the version number follows the array length).
 * Records are copied as they are; the shape of their content is migrated separately
 * (see `model/migrations.ts`).
 */
const DB_MIGRATIONS: ((db: IDBDatabase, tx: IDBTransaction) => void)[] = [
  (db) => {
    db.createObjectStore('classes', { keyPath: 'id' })
    db.createObjectStore('photos')
  },
  (db) => {
    db.createObjectStore('salles', { keyPath: 'id' })
    db.createObjectStore('plans', { keyPath: 'id' })
  },
  (db) => {
    db.createObjectStore('meta')
  },
  // `salles` → `rooms`
  (db, tx) => {
    const rooms = db.createObjectStore('rooms', { keyPath: 'id' })
    const read = tx.objectStore('salles').getAll()
    read.onsuccess = () => {
      for (const record of read.result) rooms.put(record)
      db.deleteObjectStore('salles')
    }
  },
]
const DB_VERSION = DB_MIGRATIONS.length

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = (event) => {
      for (let v = event.oldVersion; v < DB_VERSION; v++) DB_MIGRATIONS[v](open.result, open.transaction!)
    }
    open.onsuccess = () => {
      // Another (newer) tab wants to upgrade the database: release our connection.
      open.result.onversionchange = () => open.result.close()
      resolve(open.result)
    }
    open.onblocked = () => reject(new Error('Fermez les autres onglets de l’application puis rechargez.'))
    open.onerror = () => reject(open.error)
  })
}

export function indexedDbStorage(): Storage {
  const dbPromise = openDb()
  const store = async (name: StoreName, mode: IDBTransactionMode) =>
    (await dbPromise).transaction(name, mode).objectStore(name)
  const all = (name: StoreName) => async () => request((await store(name, 'readonly')).getAll())
  const put = (name: StoreName) => async (record: unknown) =>
    void (await request((await store(name, 'readwrite')).put(record)))
  const remove = (name: StoreName) => async (id: string) =>
    void (await request((await store(name, 'readwrite')).delete(id)))

  return {
    loadClasses: all('classes'),
    saveClass: put('classes'),
    deleteClass: remove('classes'),
    loadRooms: all('rooms'),
    saveRoom: put('rooms'),
    deleteRoom: remove('rooms'),
    loadPlans: all('plans'),
    savePlan: put('plans'),
    deletePlan: remove('plans'),
    async putPhoto(id, blob) {
      await request((await store('photos', 'readwrite')).put(blob, id))
    },
    async getPhoto(id) {
      return request((await store('photos', 'readonly')).get(id))
    },
    deletePhoto: remove('photos'),
    async listPhotoIds() {
      return (await request((await store('photos', 'readonly')).getAllKeys())) as string[]
    },
    async getMeta<T>(key: string) {
      return request((await store('meta', 'readonly')).get(key)) as Promise<T | undefined>
    },
    async setMeta(key, value) {
      await request((await store('meta', 'readwrite')).put(value, key))
    },
  }
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence() {
  try {
    return await navigator.storage?.persist?.()
  } catch {
    return false
  }
}
