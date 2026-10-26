import type { Storage } from './storage'

const DB_NAME = 'plandeclasse'
type StoreName = 'classes' | 'salles' | 'plans' | 'photos' | 'meta'

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

/**
 * Migrations de la STRUCTURE de la base (object stores). L'index i migre de la version i vers i+1.
 * Ne jamais modifier une étape existante : en ajouter une et incrémenter DB_VERSION (implicite).
 */
const MIGRATIONS_DB: ((db: IDBDatabase) => void)[] = [
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
]
const DB_VERSION = MIGRATIONS_DB.length

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = (e) => {
      for (let v = e.oldVersion; v < DB_VERSION; v++) MIGRATIONS_DB[v](open.result)
    }
    open.onsuccess = () => {
      // Une autre fenêtre (plus récente) veut migrer la base : on libère la connexion.
      open.result.onversionchange = () => open.result.close()
      resolve(open.result)
    }
    open.onblocked = () => reject(new Error('Fermez les autres onglets de l’application puis rechargez.'))
    open.onerror = () => reject(open.error)
  })
}

export function indexedDbStorage(): Storage {
  const dbp = openDb()
  const store = async (name: StoreName, mode: IDBTransactionMode) =>
    (await dbp).transaction(name, mode).objectStore(name)
  const all = (name: StoreName) => async () => req((await store(name, 'readonly')).getAll())
  const put = (name: StoreName) => async (x: unknown) => void (await req((await store(name, 'readwrite')).put(x)))
  const del = (name: StoreName) => async (id: string) => void (await req((await store(name, 'readwrite')).delete(id)))

  return {
    loadClasses: all('classes'),
    saveClass: put('classes'),
    deleteClass: del('classes'),
    loadSalles: all('salles'),
    saveSalle: put('salles'),
    deleteSalle: del('salles'),
    loadPlans: all('plans'),
    savePlan: put('plans'),
    deletePlan: del('plans'),
    async putPhoto(id, blob) {
      await req((await store('photos', 'readwrite')).put(blob, id))
    },
    async getPhoto(id) {
      return req((await store('photos', 'readonly')).get(id))
    },
    deletePhoto: del('photos'),
    async getMeta<T>(cle: string) {
      return req((await store('meta', 'readonly')).get(cle)) as Promise<T | undefined>
    },
    async setMeta(cle, valeur) {
      await req((await store('meta', 'readwrite')).put(valeur, cle))
    },
    async listPhotoIds() {
      return (await req((await store('photos', 'readonly')).getAllKeys())) as string[]
    },
  }
}

/** Demande au navigateur de ne pas évincer les données. */
export async function demanderPersistance() {
  try {
    return await navigator.storage?.persist?.()
  } catch {
    return false
  }
}
