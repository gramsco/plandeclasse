import type { Plan, Room, SchoolClass } from '../model/types'

/**
 * Persistence layer: JSON documents for classes, rooms and plans; Blobs for photos
 * (keyed by id, like an object store).
 *
 * The `load*` methods return records exactly as stored, which for old data versions may not
 * match the current types: callers must run them through the data migrations first.
 */
export interface Storage {
  loadClasses(): Promise<SchoolClass[]>
  saveClass(schoolClass: SchoolClass): Promise<void>
  deleteClass(id: string): Promise<void>
  loadRooms(): Promise<Room[]>
  saveRoom(room: Room): Promise<void>
  deleteRoom(id: string): Promise<void>
  loadPlans(): Promise<Plan[]>
  savePlan(plan: Plan): Promise<void>
  deletePlan(id: string): Promise<void>
  putPhoto(id: string, blob: Blob): Promise<void>
  getPhoto(id: string): Promise<Blob | undefined>
  deletePhoto(id: string): Promise<void>
  listPhotoIds(): Promise<string[]>
  /** Small technical values (data version, backup taken before a migration…). */
  getMeta<T = unknown>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
}
