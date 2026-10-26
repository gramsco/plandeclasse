import type { Storage } from './storage'

function table<T extends { id: string }>() {
  const records = new Map<string, T>()
  return {
    all: async () => structuredClone([...records.values()]),
    put: async (record: T) => void records.set(record.id, structuredClone(record)),
    delete: async (id: string) => void records.delete(id),
  }
}

/** In-memory implementation, used by the tests. */
export function memoryStorage(): Storage {
  const classes = table<Parameters<Storage['saveClass']>[0]>()
  const rooms = table<Parameters<Storage['saveRoom']>[0]>()
  const plans = table<Parameters<Storage['savePlan']>[0]>()
  const photos = new Map<string, Blob>()
  const meta = new Map<string, unknown>()
  return {
    loadClasses: classes.all,
    saveClass: classes.put,
    deleteClass: classes.delete,
    loadRooms: rooms.all,
    saveRoom: rooms.put,
    deleteRoom: rooms.delete,
    loadPlans: plans.all,
    savePlan: plans.put,
    deletePlan: plans.delete,
    async putPhoto(id, blob) {
      photos.set(id, blob)
    },
    async getPhoto(id) {
      return photos.get(id)
    },
    async deletePhoto(id) {
      photos.delete(id)
    },
    async listPhotoIds() {
      return [...photos.keys()]
    },
    async getMeta<T>(key: string) {
      return meta.get(key) as T | undefined
    },
    async setMeta(key, value) {
      meta.set(key, structuredClone(value))
    },
  }
}
