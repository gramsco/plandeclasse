import { migrer, VERSION_DONNEES } from '../model/migrations'
import {
  normaliserClasse,
  normaliserPlan,
  normaliserSalle,
  type Classe,
  type Plan,
  type Salle,
} from '../model/types'
import type { Storage } from '../storage/storage'

export const FORMAT = 'classe'
export const VERSION_FICHIER = VERSION_DONNEES

export type FichierClasse = {
  format: typeof FORMAT
  version: number
  application?: string // version de l'application qui a écrit le fichier
  exporteLe: string
  classes: Classe[]
  salles: Salle[]
  plans: Plan[]
  photos: Record<string, { type: string; base64: string }>
}

export async function blobVersBase64(blob: Blob): Promise<string> {
  const octets = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function base64VersBlob(base64: string, type: string): Blob {
  const bin = atob(base64)
  const octets = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i)
  return new Blob([octets], { type })
}

export async function construireFichier(
  data: { classes: Classe[]; salles: Salle[]; plans: Plan[] },
  storage: Storage,
): Promise<FichierClasse> {
  const photos: FichierClasse['photos'] = {}
  for (const id of new Set(data.classes.flatMap((c) => c.eleves.map((e) => e.photoId)))) {
    if (!id) continue
    const blob = await storage.getPhoto(id)
    if (blob) photos[id] = { type: blob.type || 'image/jpeg', base64: await blobVersBase64(blob) }
  }
  return {
    format: FORMAT,
    version: VERSION_FICHIER,
    application: typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__,
    exporteLe: new Date().toISOString(),
    classes: data.classes,
    salles: data.salles,
    plans: data.plans,
    photos,
  }
}

/** Lit et valide un fichier .classe ; lève une Error lisible si le contenu est invalide. */
export function lireFichier(texte: string): FichierClasse {
  let brut: Record<string, unknown>
  try {
    brut = JSON.parse(texte)
  } catch {
    throw new Error("Ce fichier n'est pas un fichier .classe valide.")
  }
  if (!brut || brut.format !== FORMAT) throw new Error("Ce fichier n'est pas un fichier .classe valide.")
  const version = brut.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    throw new Error("Ce fichier n'est pas un fichier .classe valide.")
  if (version > VERSION_FICHIER)
    throw new Error(
      `Ce fichier vient d'une version plus récente de l'application (format ${version}, cette version comprend jusqu'au format ${VERSION_FICHIER}). Rechargez la page ou mettez l'application à jour.`,
    )
  const liste = (k: string) => {
    const v = brut[k]
    if (v !== undefined && !Array.isArray(v)) throw new Error(`Fichier corrompu (« ${k} »).`)
    return (v ?? []) as unknown[]
  }
  try {
    // Les anciens fichiers sont migrés vers le format courant, puis normalisés par sécurité.
    const d = migrer({ classes: liste('classes'), salles: liste('salles'), plans: liste('plans') }, version)
    return {
      format: FORMAT,
      version: VERSION_FICHIER,
      application: typeof brut.application === 'string' ? brut.application : undefined,
      exporteLe: String(brut.exporteLe ?? ''),
      classes: d.classes.map(normaliserClasse),
      salles: d.salles.map(normaliserSalle),
      plans: d.plans.map(normaliserPlan),
      photos: (brut.photos ?? {}) as FichierClasse['photos'],
    }
  } catch {
    throw new Error('Fichier corrompu.')
  }
}

export function telecharger(fichier: FichierClasse, nom: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(fichier)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
