/* lang-ignore-file: snapshots of data written by older releases, which used French field names */

/** Data version 1 (first release). */
export const LEGACY_V1 = {
  classes: [
    {
      id: 'c1',
      nom: 'Old',
      tags: [],
      regles: [],
      eleves: [{ id: 'e1', prenom: 'Ada', nom: 'L', tagIds: ['t'] }],
    },
  ],
  salles: [{ id: 's1', nom: 'S', largeur: 1200, hauteur: 800, grille: 10, meubles: [] }],
  plans: [{ id: 'p1', nom: 'P', classeId: 'c1', salleId: 's1', affectations: {} }],
}

/** Data version 2 (last release before the English rename), with every kind of record and rule. */
export const LEGACY_V2 = {
  classes: [
    {
      id: 'c1',
      nom: '6e A',
      eleves: [
        {
          id: 'e1',
          prenom: 'Ada',
          nom: 'Lovelace',
          annotations: ['PAP'],
          feu: 'rouge',
          genre: 'fille',
          role: 'eleve',
          accompagne: [],
        },
        { id: 'e2', prenom: 'Sam', nom: '', annotations: [], feu: 'vert', role: 'aesh', accompagne: ['e1'] },
      ],
    },
  ],
  salles: [
    {
      id: 's1',
      nom: 'Salle 12',
      largeur: 1200,
      hauteur: 800,
      grille: 10,
      meubles: [
        {
          id: 'm1',
          type: 'ilot',
          x: 10,
          y: 20,
          rotation: 90,
          largeur: 200,
          hauteur: 184,
          places: [{ id: 'p1', dx: 1, dy: 2 }],
        },
      ],
    },
  ],
  plans: [
    {
      id: 'p1',
      nom: 'Plan',
      classeId: 'c1',
      salleId: 's1',
      affectations: { p1: 'e1' },
      regles: [
        { id: 'r1', type: 'separer', eleveA: 'e1', eleveB: 'e2' },
        { id: 'r2', type: 'couleurs', a: 'rouge', b: 'orange' },
        { id: 'r3', type: 'influence', eleve: 'e1', avec: 'e2', devient: 'orange' },
      ],
      statut: 'en_test',
      notes: 'n',
      parentId: 'p0',
      creeLe: '2026-01-01',
      testeDepuis: '2026-01-02',
    },
  ],
}

/** The same data as an exported `.classe` file. */
export const legacyFile = (version: 1 | 2) => ({
  format: 'classe',
  version,
  ...(version === 1 ? LEGACY_V1 : { ...LEGACY_V2, exporteLe: '2026-01-01' }),
  photos: {},
})
