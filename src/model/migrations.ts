/**
 * Version du format des DONNÉES (classes, salles, plans), partagée par la base locale et les
 * fichiers .classe. À incrémenter à chaque changement de structure, avec une migration `n → n+1`.
 *
 *  1 : première version (classes avec tags/règles, plans simples)
 *  2 : V2 — feu tricolore, AESH, genre, annotations ; règles, statut et notes par plan
 */
export const VERSION_DONNEES = 2

export type Donnees = { classes: unknown[]; salles: unknown[]; plans: unknown[] }

/* eslint-disable @typescript-eslint/no-explicit-any */
const MIGRATIONS: Record<number, (d: Donnees) => Donnees> = {
  1: (d) => ({
    classes: (d.classes as any[]).map(({ regles: _r, tags: _t, meubles: _m, salle: _s, ...c }) => ({
      ...c,
      eleves: (c.eleves ?? []).map(({ tagIds: _ti, placeId: _p, ...e }: any) => ({
        feu: 'vert',
        role: 'eleve',
        annotations: [],
        accompagne: [],
        ...e,
      })),
    })),
    salles: d.salles,
    plans: (d.plans as any[]).map((p) => ({
      regles: [],
      statut: 'brouillon',
      notes: '',
      creeLe: new Date().toISOString(),
      ...p,
    })),
  }),
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Applique les migrations de `de` jusqu'à la version courante. */
export function migrer(donnees: Donnees, de: number): Donnees {
  let d = donnees
  for (let v = de; v < VERSION_DONNEES; v++) {
    const m = MIGRATIONS[v]
    if (!m) throw new Error(`Migration ${v} → ${v + 1} manquante.`)
    d = m(d)
  }
  return d
}
