import type { Meuble, Salle } from './types'

export type Rect = { x: number; y: number; w: number; h: number }

/** Taille de la carte élève dessinée sur une place. */
export const CARTE = { w: 94, h: 92 }
/** Photo (cercle) dans la carte. */
export const PHOTO = { cx: 47, cy: 33, r: 30 }

/** Rectangle réellement occupé (tient compte de la rotation, centre conservé). */
export function emprise(m: Meuble): Rect {
  const cx = m.x + m.largeur / 2
  const cy = m.y + m.hauteur / 2
  const tourne = m.rotation === 90 || m.rotation === 270
  const w = tourne ? m.hauteur : m.largeur
  const h = tourne ? m.largeur : m.hauteur
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

export function centrePlace(m: Meuble, p: { dx: number; dy: number }) {
  const cx = m.x + m.largeur / 2
  const cy = m.y + m.hauteur / 2
  const { dx, dy } = p
  switch (m.rotation) {
    case 90:
      return { x: cx - dy, y: cy + dx }
    case 180:
      return { x: cx - dx, y: cy - dy }
    case 270:
      return { x: cx + dy, y: cy - dx }
    default:
      return { x: cx + dx, y: cy + dy }
  }
}

export type PlaceMonde = { placeId: string; meubleId: string; x: number; y: number; rotation: number }

/** Toutes les places de la salle, dans l'ordre de lecture (haut→bas, gauche→droite). */
export function placesSalle(salle: Salle): PlaceMonde[] {
  return salle.meubles
    .flatMap((m) =>
      m.places.map((p) => ({ placeId: p.id, meubleId: m.id, rotation: m.rotation, ...centrePlace(m, p) })),
    )
    .sort((a, b) => Math.round(a.y / 20) - Math.round(b.y / 20) || a.x - b.x)
}

/**
 * Aimantation « semi-magnétique » : s'accroche aux bords des autres tables sous `seuil`,
 * sinon à la grille ; reste dans la salle. Renvoie la correction à appliquer.
 */
export function aimanter(
  r: Rect,
  autres: Rect[],
  salle: { largeur: number; hauteur: number; grille: number },
  seuil = 8,
): { dx: number; dy: number } {
  const axe = (pos: number, taille: number, bords: number[], grille: number, max: number) => {
    let meilleur: number | undefined
    for (const b of bords) {
      for (const d of [b - pos, b - (pos + taille)]) {
        if (Math.abs(d) <= seuil && (meilleur === undefined || Math.abs(d) < Math.abs(meilleur))) meilleur = d
      }
    }
    let d = meilleur ?? (grille ? Math.round(pos / grille) * grille - pos : 0)
    const nouvelle = Math.min(Math.max(pos + d, 0), Math.max(0, max - taille))
    d = nouvelle - pos
    return d
  }
  return {
    dx: axe(r.x, r.w, autres.flatMap((o) => [o.x, o.x + o.w]), salle.grille, salle.largeur),
    dy: axe(r.y, r.h, autres.flatMap((o) => [o.y, o.y + o.h]), salle.grille, salle.hauteur),
  }
}
