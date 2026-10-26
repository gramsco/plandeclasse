import { placesSalle } from './geometry'
import { estAesh, nomComplet, type Classe, type Feu, type Plan, type Salle } from './types'

export type Relation = 'cote' | 'face' | 'diagonale' | 'allee'
type Pos = { x: number; y: number; rotation?: number }

const RANG: Record<Relation, number> = { cote: 4, face: 3, diagonale: 2, allee: 1 }
const LIBELLE: Record<Relation, string> = {
  cote: 'côte à côte',
  face: 'devant / derrière',
  diagonale: 'en diagonale',
  allee: 'de part et d\'autre d\'une allée',
}

/** Relation de b par rapport à a, dans le repère de a (l'avant de la place = direction de la rotation). */
function relationDans(a: Pos, b: Pos): Relation | null {
  const r = ((a.rotation ?? 0) * Math.PI) / 180
  const vx = b.x - a.x
  const vy = b.y - a.y
  // avant = (0,-1) tourné de r (sens horaire, y vers le bas) ; droite = avant tourné de 90°
  const avant = { x: Math.sin(r), y: -Math.cos(r) }
  const droite = { x: Math.cos(r), y: Math.sin(r) }
  const lat = Math.abs(vx * droite.x + vy * droite.y)
  const prof = Math.abs(vx * avant.x + vy * avant.y)
  if (prof <= 45 && lat <= 130) return 'cote'
  if (lat <= 55 && prof <= 140) return 'face'
  if (lat <= 130 && prof <= 140) return 'diagonale'
  if (prof <= 45 && lat <= 190) return 'allee'
  return null
}

/** Relation entre deux places (la plus forte des deux repères). */
export function relation(a: Pos, b: Pos): Relation | null {
  const r1 = relationDans(a, b)
  const r2 = relationDans(b, a)
  if (!r1 || !r2) return r1 ?? r2
  return RANG[r1] >= RANG[r2] ? r1 : r2
}

export type Niveau = 'erreur' | 'attention' | 'info'

export type Alerte = { id: string; niveau: Niveau; message: string; eleves: string[] }
export type Lien = { a: string; b: string; type: 'conflit' | 'aesh'; niveau: Niveau }
export type Analyse = {
  alertes: Alerte[]
  liens: Lien[]
  feuEffectif: Record<string, Feu>
}

const GRAVITE: Record<Feu, number> = { vert: 0, orange: 1, rouge: 2 }
const pire = (a: Feu, b: Feu) => (GRAVITE[b] > GRAVITE[a] ? b : a)
const niveauDe = (r: Relation): Niveau => (r === 'cote' ? 'erreur' : 'attention')

export function analyser(plan: Plan, classe: Classe, salle: Salle): Analyse {
  const alertes: Alerte[] = []
  const liens: Lien[] = []
  const parId = new Map(classe.eleves.map((e) => [e.id, e]))
  const places = new Map(placesSalle(salle).map((p) => [p.placeId, p]))
  const pos = new Map<string, Pos>()
  for (const [placeId, eleveId] of Object.entries(plan.affectations)) {
    const p = places.get(placeId)
    if (p && parId.has(eleveId)) pos.set(eleveId, p)
  }
  const nom = (id: string) => nomComplet(parId.get(id)!)

  const placees = [...pos.keys()]
  const rel = new Map<string, Relation>()
  const cle = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (let i = 0; i < placees.length; i++)
    for (let j = i + 1; j < placees.length; j++) {
      const r = relation(pos.get(placees[i])!, pos.get(placees[j])!)
      if (r) rel.set(cle(placees[i], placees[j]), r)
    }
  const relDe = (a: string, b: string) => rel.get(cle(a, b))

  // Couleur effective : l'influence ne peut qu'aggraver.
  const feuEffectif: Record<string, Feu> = {}
  for (const id of placees) {
    const e = parId.get(id)!
    if (!estAesh(e)) feuEffectif[id] = e.feu
  }
  for (const r of plan.regles) {
    if (r.type !== 'influence' || !pos.has(r.eleve) || !pos.has(r.avec)) continue
    const x = relDe(r.eleve, r.avec)
    if (x !== 'cote' && x !== 'face') continue
    const avant = feuEffectif[r.eleve]
    feuEffectif[r.eleve] = pire(avant, r.devient)
    if (feuEffectif[r.eleve] !== avant)
      alertes.push({
        id: `inf-${r.id}`,
        niveau: 'info',
        message: `${nom(r.eleve)} devient ${feuEffectif[r.eleve]} près de ${nom(r.avec)}`,
        eleves: [r.eleve, r.avec],
      })
  }

  const conflit = (id: string, a: string, b: string, r: Relation, message: string) => {
    alertes.push({ id, niveau: niveauDe(r), message: `${message} (${LIBELLE[r]})`, eleves: [a, b] })
    liens.push({ a, b, type: 'conflit', niveau: niveauDe(r) })
  }

  for (const r of plan.regles) {
    if (r.type === 'separer') {
      const x = relDe(r.eleveA, r.eleveB)
      if (x) conflit(`sep-${r.id}`, r.eleveA, r.eleveB, x, `${nom(r.eleveA)} et ${nom(r.eleveB)} doivent être séparés`)
    } else if (r.type === 'couleurs') {
      const ids = placees.filter((id) => feuEffectif[id])
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const [fa, fb] = [feuEffectif[ids[i]], feuEffectif[ids[j]]]
          const ok = (fa === r.a && fb === r.b) || (fa === r.b && fb === r.a)
          const x = ok && relDe(ids[i], ids[j])
          if (x) conflit(`col-${r.id}-${ids[i]}-${ids[j]}`, ids[i], ids[j], x, `${r.a === r.b ? `Deux ${r.a}s` : `${r.a} et ${r.b}`} : ${nom(ids[i])} et ${nom(ids[j])}`)
        }
    }
  }

  for (const aesh of classe.eleves.filter(estAesh)) {
    const suivis = aesh.accompagne.filter((id) => parId.has(id))
    if (!pos.has(aesh.id)) {
      alertes.push({
        id: `aesh-absent-${aesh.id}`,
        niveau: 'attention',
        message: `AESH ${nomComplet(aesh)} n'est pas placé(e)${suivis.length ? ` (accompagne ${suivis.map(nom).join(', ')})` : ''}`,
        eleves: [aesh.id],
      })
      continue
    }
    if (!suivis.length)
      alertes.push({ id: `aesh-libre-${aesh.id}`, niveau: 'info', message: `AESH ${nomComplet(aesh)} n'a pas d'élève à accompagner`, eleves: [aesh.id] })
    for (const id of suivis) {
      if (!pos.has(id)) continue // un élève non placé se voit déjà dans la liste « à placer »
      if (relDe(aesh.id, id)) liens.push({ a: aesh.id, b: id, type: 'aesh', niveau: 'info' })
      else
        alertes.push({
          id: `aesh-loin-${aesh.id}-${id}`,
          niveau: 'erreur',
          message: `AESH ${nomComplet(aesh)} est trop loin de ${nom(id)}`,
          eleves: [aesh.id, id],
        })
    }
  }

  const ordre: Record<Niveau, number> = { erreur: 0, attention: 1, info: 2 }
  alertes.sort((x, y) => ordre[x.niveau] - ordre[y.niveau])
  return { alertes, liens, feuEffectif }
}
