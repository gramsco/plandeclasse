import { DATA_VERSION, migrate } from '../model/migrations'
import { normalizeClass, normalizePlan, normalizeRoom, type Plan, type Room, type SchoolClass } from '../model/types'
import type { Storage } from '../storage/storage'

/** Format identifier written in `.classe` files (the extension is part of the product's name). */
export const FORMAT = 'classe'
export const FILE_VERSION = DATA_VERSION

export type ExportFile = {
  format: typeof FORMAT
  version: number
  application?: string // version of the application that wrote the file
  exportedAt: string
  classes: SchoolClass[]
  rooms: Room[]
  plans: Plan[]
  photos: Record<string, { type: string; base64: string }>
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function buildFile(
  data: { classes: SchoolClass[]; rooms: Room[]; plans: Plan[] },
  storage: Storage,
): Promise<ExportFile> {
  const photos: ExportFile['photos'] = {}
  for (const id of new Set(data.classes.flatMap((c) => c.students.map((s) => s.photoId)))) {
    if (!id) continue
    const blob = await storage.getPhoto(id)
    if (blob) photos[id] = { type: blob.type || 'image/jpeg', base64: await blobToBase64(blob) }
  }
  return {
    format: FORMAT,
    version: FILE_VERSION,
    application: typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__,
    exportedAt: new Date().toISOString(),
    classes: data.classes,
    rooms: data.rooms,
    plans: data.plans,
    photos,
  }
}

/** Reads and validates a `.classe` file, migrating old formats. Throws a user-readable Error if invalid. */
export function readFile(text: string): ExportFile {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("Ce fichier n'est pas un fichier .classe valide.")
  }
  if (!raw || raw.format !== FORMAT) throw new Error("Ce fichier n'est pas un fichier .classe valide.")
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    throw new Error("Ce fichier n'est pas un fichier .classe valide.")
  if (version > FILE_VERSION)
    throw new Error(
      `Ce fichier vient d'une version plus récente de l'application (format ${version}, cette version comprend jusqu'au format ${FILE_VERSION}). Rechargez la page ou mettez l'application à jour.`,
    )
  const list = (key: string) => {
    const value = raw[key]
    if (value !== undefined && !Array.isArray(value)) throw new Error(`Fichier corrompu (« ${key} »).`)
    return (value ?? []) as unknown[]
  }
  try {
    // Old files are migrated to the current format, then normalised for safety.
    const roomsKey = version < 3 ? 'salles' : 'rooms' // renamed in data version 3
    const rawData =
      version < 3
        ? { classes: list('classes'), salles: list(roomsKey), plans: list('plans') } // lang-ignore: legacy key
        : { classes: list('classes'), rooms: list(roomsKey), plans: list('plans') }
    const data = migrate(rawData, version)
    return {
      format: FORMAT,
      version: FILE_VERSION,
      application: typeof raw.application === 'string' ? raw.application : undefined,
      exportedAt: String(raw.exportedAt ?? raw.exporteLe ?? ''),
      classes: data.classes.map(normalizeClass),
      rooms: data.rooms.map(normalizeRoom),
      plans: data.plans.map(normalizePlan),
      photos: (raw.photos ?? {}) as ExportFile['photos'],
    }
  } catch {
    throw new Error('Fichier corrompu.')
  }
}

export function download(file: ExportFile, fileName: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
