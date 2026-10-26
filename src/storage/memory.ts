import type { Storage } from './storage'

function table<T extends { id: string }>() {
  const m = new Map<string, T>()
  return {
    all: async () => structuredClone([...m.values()]),
    put: async (x: T) => void m.set(x.id, structuredClone(x)),
    del: async (id: string) => void m.delete(id),
  }
}

export function memoryStorage(): Storage {
  const classes = table<Parameters<Storage['saveClass']>[0]>()
  const salles = table<Parameters<Storage['saveSalle']>[0]>()
  const plans = table<Parameters<Storage['savePlan']>[0]>()
  const photos = new Map<string, Blob>()
  const meta = new Map<string, unknown>()
  return {
    loadClasses: classes.all,
    saveClass: classes.put,
    deleteClass: classes.del,
    loadSalles: salles.all,
    saveSalle: salles.put,
    deleteSalle: salles.del,
    loadPlans: plans.all,
    savePlan: plans.put,
    deletePlan: plans.del,
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
    async getMeta<T>(cle: string) {
      return meta.get(cle) as T | undefined
    },
    async setMeta(cle, valeur) {
      meta.set(cle, structuredClone(valeur))
    },
  }
}
