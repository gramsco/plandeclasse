import { placesSalle } from './geometry'
import type { Classe, Plan, Regle, Salle } from './types'

/** Retire les affectations devenues invalides (place ou élève disparus, doublons). */
export function purgerAffectations(plan: Plan, classe: Classe | undefined, salle: Salle | undefined) {
  const places = new Set(salle?.meubles.flatMap((m) => m.places.map((p) => p.id)))
  const eleves = new Set(classe?.eleves.map((e) => e.id))
  const vus = new Set<string>()
  const aff: Record<string, string> = {}
  for (const [placeId, eleveId] of Object.entries(plan.affectations)) {
    if (places.has(placeId) && eleves.has(eleveId) && !vus.has(eleveId)) {
      aff[placeId] = eleveId
      vus.add(eleveId)
    }
  }
  return aff
}

/** Place un élève (ou le retire si placeId = null) ; échange si la place est occupée. */
export function placer(aff: Record<string, string>, eleveId: string, placeId: string | null) {
  const res = { ...aff }
  const ancienne = Object.keys(res).find((k) => res[k] === eleveId)
  if (ancienne) delete res[ancienne]
  if (placeId) {
    const occupant = res[placeId]
    res[placeId] = eleveId
    if (occupant && ancienne) res[ancienne] = occupant
  }
  return res
}

/** Répartit au hasard les élèves non placés sur les places libres (ordre de lecture). */
export function remplirAleatoire(plan: Plan, classe: Classe, salle: Salle, rng = Math.random) {
  const aff = { ...plan.affectations }
  const places = placesSalle(salle).map((p) => p.placeId).filter((id) => !aff[id])
  const places_prises = new Set(Object.values(aff))
  const restants = classe.eleves.map((e) => e.id).filter((id) => !places_prises.has(id))
  for (let i = restants.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[restants[i], restants[j]] = [restants[j], restants[i]]
  }
  places.forEach((placeId, i) => {
    if (restants[i]) aff[placeId] = restants[i]
  })
  return aff
}

/** Retire les règles qui citent un élève disparu. */
export function purgerRegles(regles: Regle[], classe: Classe | undefined): Regle[] {
  const ids = new Set(classe?.eleves.map((e) => e.id))
  return regles.filter((r) => {
    if (r.type === 'separer') return ids.has(r.eleveA) && ids.has(r.eleveB)
    if (r.type === 'influence') return ids.has(r.eleve) && ids.has(r.avec)
    return true
  })
}
