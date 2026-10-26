import type { Classe, Plan, Salle } from '../model/types'

/** Couche de persistance : JSON pour classes/salles/plans, Blobs pour les photos (clé = id, façon S3). */
export interface Storage {
  loadClasses(): Promise<Classe[]>
  saveClass(c: Classe): Promise<void>
  deleteClass(id: string): Promise<void>
  loadSalles(): Promise<Salle[]>
  saveSalle(s: Salle): Promise<void>
  deleteSalle(id: string): Promise<void>
  loadPlans(): Promise<Plan[]>
  savePlan(p: Plan): Promise<void>
  deletePlan(id: string): Promise<void>
  putPhoto(id: string, blob: Blob): Promise<void>
  getPhoto(id: string): Promise<Blob | undefined>
  deletePhoto(id: string): Promise<void>
  listPhotoIds(): Promise<string[]>
  /** Petites valeurs techniques (version des données, sauvegarde avant migration…). */
  getMeta<T = unknown>(cle: string): Promise<T | undefined>
  setMeta(cle: string, valeur: unknown): Promise<void>
}
