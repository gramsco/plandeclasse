export type Feu = 'vert' | 'orange' | 'rouge'
export const FEUX: Feu[] = ['vert', 'orange', 'rouge']
export const LIBELLE_FEU: Record<Feu, string> = { vert: 'Sympa', orange: 'À surveiller', rouge: 'Perturbateur' }

export type Regle =
  | { id: string; type: 'separer'; eleveA: string; eleveB: string }
  | { id: string; type: 'couleurs'; a: Feu; b: Feu }
  | { id: string; type: 'influence'; eleve: string; avec: string; devient: Feu }

export type Genre = 'fille' | 'garcon'

/** Élève, ou AESH (role = 'aesh') qui accompagne certains élèves. */
export type Eleve = {
  id: string
  prenom: string
  nom: string
  photoId?: string
  annotations: string[] // PAP, PPS, DYS… (libres)
  feu: Feu
  genre?: Genre // non renseigné tant qu'on ne l'a pas choisi
  role: 'eleve' | 'aesh'
  accompagne: string[]
}

/** Une classe = une liste de personnes (indépendante de tout lieu). */
export type Classe = {
  id: string
  nom: string
  eleves: Eleve[]
}

export type Place = { id: string; dx: number; dy: number } // décalage depuis le centre de la table, non pivoté

export type TypeMeuble = 'individuelle' | 'double' | 'ilot' | 'chaise' | 'prof'
export type Rotation = 0 | 90 | 180 | 270

export type Meuble = {
  id: string
  type: TypeMeuble
  x: number // coin haut-gauche de la table non pivotée
  y: number
  rotation: Rotation
  largeur: number
  hauteur: number
  places: Place[]
}

/** Une salle = un lieu physique : tables et places. */
export type Salle = {
  id: string
  nom: string
  largeur: number
  hauteur: number
  grille: number
  meubles: Meuble[]
}

export type StatutPlan = 'brouillon' | 'en_test' | 'retenu' | 'abandonne'
export const LIBELLE_STATUT: Record<StatutPlan, string> = {
  brouillon: 'Hypothèse',
  en_test: 'En test',
  retenu: 'Retenu',
  abandonne: 'Abandonné',
}

/** Un plan = une classe placée dans une salle ; c'est aussi une hypothèse à éprouver. */
export type Plan = {
  id: string
  nom: string
  classeId: string
  salleId: string
  affectations: Record<string, string> // placeId -> eleveId
  regles: Regle[]
  statut: StatutPlan
  notes: string
  parentId?: string
  creeLe: string
  testeDepuis?: string
}

export const newId = () => crypto.randomUUID()

export const newClasse = (nom: string, nbEleves = 0): Classe => ({
  id: newId(),
  nom,
  eleves: Array.from({ length: nbEleves }, (_, i) => newEleve(`Élève ${i + 1}`)),
})

export const newEleve = (prenom: string, nom = ''): Eleve => ({
  id: newId(),
  prenom,
  nom,
  annotations: [],
  feu: 'vert',
  role: 'eleve',
  accompagne: [],
})

/** Annotations courantes proposées (libellé → signification). */
export const ANNOTATIONS_COURANTES: Record<string, string> = {
  PAP: "Plan d'accompagnement personnalisé",
  PPS: 'Projet personnalisé de scolarisation',
  PAI: "Projet d'accueil individualisé",
  PPRE: 'Programme personnalisé de réussite éducative',
  DYS: 'Troubles « dys »',
  HPI: 'Haut potentiel intellectuel',
  UPE2A: 'Élève allophone',
  TDAH: "Trouble de l'attention",
}

export const newAesh = (prenom: string, nom = ''): Eleve => ({ ...newEleve(prenom, nom), role: 'aesh' })

export const estAesh = (e: Eleve) => e.role === 'aesh'
export const nomComplet = (e: Eleve) => `${e.prenom} ${e.nom}`.trim()

// ---- Normalisation : complète les données anciennes ou importées ----
/* eslint-disable @typescript-eslint/no-explicit-any */
export const normaliserEleve = (e: any): Eleve => ({
  id: String(e.id),
  prenom: String(e.prenom ?? ''),
  nom: String(e.nom ?? ''),
  photoId: e.photoId ? String(e.photoId) : undefined,
  annotations: Array.isArray(e.annotations) ? e.annotations.map(String) : [],
  feu: FEUX.includes(e.feu) ? e.feu : 'vert',
  genre: e.genre === 'fille' || e.genre === 'garcon' ? e.genre : undefined,
  role: e.role === 'aesh' ? 'aesh' : 'eleve',
  accompagne: Array.isArray(e.accompagne) ? e.accompagne : [],
})

export const normaliserClasse = (c: any): Classe => ({
  id: String(c.id),
  nom: String(c.nom ?? 'Classe'),
  eleves: (c.eleves ?? []).map(normaliserEleve),
})

export const normaliserSalle = (s: any): Salle => ({
  id: String(s.id),
  nom: String(s.nom ?? 'Salle'),
  largeur: Number(s.largeur) || 1200,
  hauteur: Number(s.hauteur) || 800,
  grille: Number(s.grille) || 10,
  meubles: Array.isArray(s.meubles) ? s.meubles : [],
})

export const normaliserPlan = (p: any): Plan => ({
  id: String(p.id),
  nom: String(p.nom ?? 'Plan'),
  classeId: String(p.classeId),
  salleId: String(p.salleId),
  affectations: p.affectations && typeof p.affectations === 'object' ? p.affectations : {},
  regles: Array.isArray(p.regles) ? p.regles.filter((r: any) => r && ['separer', 'couleurs', 'influence'].includes(r.type)) : [],
  statut: p.statut in LIBELLE_STATUT ? p.statut : 'brouillon',
  notes: String(p.notes ?? ''),
  parentId: p.parentId ? String(p.parentId) : undefined,
  creeLe: String(p.creeLe ?? new Date().toISOString()),
  testeDepuis: p.testeDepuis ? String(p.testeDepuis) : undefined,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Une ligne = un élève, "Prénom Nom" ou "Nom, Prénom". */
export function parseListeEleves(texte: string): Eleve[] {
  return texte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (l.includes(',')) {
        const [nom, ...rest] = l.split(',')
        return newEleve(rest.join(',').trim(), nom.trim())
      }
      const [prenom, ...rest] = l.split(/\s+/)
      return newEleve(prenom, rest.join(' '))
    })
}
