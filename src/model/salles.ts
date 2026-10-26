import { emprise } from './geometry'
import { newId, type Meuble, type Rotation, type Salle, type TypeMeuble } from './types'

export const TYPES_MEUBLE: Record<
  TypeMeuble,
  { nom: string; largeur: number; hauteur: number; places: { dx: number; dy: number }[] }
> = {
  individuelle: { nom: 'Table individuelle', largeur: 100, hauteur: 92, places: [{ dx: 0, dy: 0 }] },
  double: { nom: 'Table double', largeur: 200, hauteur: 92, places: [{ dx: -50, dy: 0 }, { dx: 50, dy: 0 }] },
  ilot: {
    nom: 'Îlot de 4',
    largeur: 200,
    hauteur: 184,
    places: [
      { dx: -50, dy: -46 },
      { dx: 50, dy: -46 },
      { dx: -50, dy: 46 },
      { dx: 50, dy: 46 },
    ],
  },
  chaise: { nom: 'Chaise d\'adulte (AESH)', largeur: 100, hauteur: 92, places: [{ dx: 0, dy: 0 }] },
  prof: { nom: 'Bureau du prof', largeur: 180, hauteur: 70, places: [] },
}

export function creerMeuble(type: TypeMeuble, x: number, y: number, rotation: Rotation = 0): Meuble {
  const t = TYPES_MEUBLE[type]
  return {
    id: newId(),
    type,
    x,
    y,
    rotation,
    largeur: t.largeur,
    hauteur: t.hauteur,
    places: t.places.map((p) => ({ id: newId(), ...p })),
  }
}

/** Crée un meuble dont l'EMPRISE (après rotation) a son coin haut-gauche en (fx, fy). */
function creerSurEmprise(type: TypeMeuble, fx: number, fy: number, rotation: Rotation = 0): Meuble {
  const m = creerMeuble(type, 0, 0, rotation)
  const e = emprise(m)
  m.x += fx - e.x
  m.y += fy - e.y
  return m
}

const salleVide = (nom: string, largeur = 1200, hauteur = 800): Salle => ({
  id: newId(),
  nom,
  largeur,
  hauteur,
  grille: 10,
  meubles: [],
})

function grille(
  salle: Salle,
  type: TypeMeuble,
  cols: number,
  rows: number,
  gapX: number,
  gapY: number,
  y0: number,
) {
  const t = TYPES_MEUBLE[type]
  const total = cols * t.largeur + (cols - 1) * gapX
  const x0 = Math.round((salle.largeur - total) / 2 / 10) * 10
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      salle.meubles.push(creerMeuble(type, x0 + c * (t.largeur + gapX), y0 + r * (t.hauteur + gapY)))
}

const bureau = (s: Salle) =>
  s.meubles.push(creerMeuble('prof', Math.round((s.largeur - 180) / 20) * 10, 40))

export type ModeleSalle = { key: string; nom: string; description: string; creer: () => Salle }

export const MODELES_SALLE: ModeleSalle[] = [
  {
    key: 'doubles-3x4',
    nom: 'Tables doubles en rangées — 24 places',
    description: '3 colonnes × 4 rangées de tables doubles',
    creer() {
      const s = salleVide('Salle (tables doubles)')
      bureau(s)
      grille(s, 'double', 3, 4, 60, 28, 170)
      return s
    },
  },
  {
    key: 'doubles-3x5',
    nom: 'Tables doubles en rangées — 30 places',
    description: '3 colonnes × 5 rangées de tables doubles',
    creer() {
      const s = salleVide('Salle (tables doubles)')
      bureau(s)
      grille(s, 'double', 3, 5, 60, 28, 160)
      return s
    },
  },
  {
    key: 'ilots-3x2',
    nom: 'Îlots de 4 — 24 places',
    description: '6 îlots de 4 élèves',
    creer() {
      const s = salleVide('Salle (îlots)')
      bureau(s)
      grille(s, 'ilot', 3, 2, 80, 40, 170)
      return s
    },
  },
  {
    key: 'individuelles-6x5',
    nom: 'Tables individuelles en rangées — 30 places',
    description: '6 colonnes × 5 rangées',
    creer() {
      const s = salleVide('Salle (tables individuelles)')
      bureau(s)
      grille(s, 'individuelle', 6, 5, 20, 24, 160)
      return s
    },
  },
  {
    key: 'u-20',
    nom: 'En U — 20 places',
    description: 'Tables sur trois côtés, face au tableau',
    creer() {
      const s = salleVide('Salle (en U)', 1400, 900)
      bureau(s)
      for (let i = 0; i < 6; i++) {
        s.meubles.push(creerSurEmprise('individuelle', 80, 160 + i * 108, 90))
        s.meubles.push(creerSurEmprise('individuelle', 1400 - 80 - 92, 160 + i * 108, 270))
      }
      for (let i = 0; i < 8; i++) s.meubles.push(creerSurEmprise('individuelle', 188 + i * 108, 790, 0))
      return s
    },
  },
  {
    key: 'vide',
    nom: 'Salle vide',
    description: 'À composer vous-même',
    creer: () => salleVide('Nouvelle salle'),
  },
]

export const modeleSalle = (key: string) => MODELES_SALLE.find((m) => m.key === key)

export const dupliquerSalle = (s: Salle): Salle => ({
  ...structuredClone(s),
  id: newId(),
  nom: `${s.nom} (copie)`,
  meubles: s.meubles.map((m) => dupliquerMeuble(m, 0)),
})

export const dupliquerMeuble = (m: Meuble, decalage = 20): Meuble => ({
  ...structuredClone(m),
  id: newId(),
  x: m.x + decalage,
  y: m.y + decalage,
  places: m.places.map((p) => ({ ...p, id: newId() })),
})
