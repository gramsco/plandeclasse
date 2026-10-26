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

/** Data version 3 (English names, before class representatives). */
export const LEGACY_V3 = {
  classes: [
    {
      id: 'c1',
      name: '6e A',
      students: [
        {
          id: 'e1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          annotations: [],
          light: 'green',
          role: 'student',
          supports: [],
        },
        { id: 'e2', firstName: 'Sam', lastName: '', annotations: [], light: 'green', role: 'aesh', supports: ['e1'] },
      ],
    },
  ],
  rooms: [{ id: 's1', name: 'Salle 12', width: 1200, height: 800, grid: 10, furniture: [] }],
  plans: [
    {
      id: 'p1',
      name: 'Plan',
      classId: 'c1',
      roomId: 's1',
      assignments: {},
      rules: [],
      status: 'draft',
      notes: '',
      createdAt: '2026-01-01',
    },
  ],
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

/** Data version 4 (class representatives, before deputies). */
export const LEGACY_V4 = {
  ...LEGACY_V3,
  classes: [
    {
      id: 'c1',
      name: '6e A',
      students: [
        {
          id: 'e1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          annotations: [],
          light: 'green',
          delegate: true,
          role: 'student',
          supports: [],
        },
        {
          id: 'e2',
          firstName: 'Sam',
          lastName: '',
          annotations: [],
          light: 'green',
          delegate: false,
          role: 'aesh',
          supports: ['e1'],
        },
      ],
    },
  ],
}

/** Data version 5 (before the "together" rule), with one rule of each older kind. */
export const LEGACY_V5 = {
  ...LEGACY_V4,
  plans: [
    {
      ...LEGACY_V4.plans[0],
      rules: [
        { id: 'r1', type: 'separate', studentA: 'e1', studentB: 'e2' },
        { id: 'r2', type: 'colors', a: 'red', b: 'orange' },
      ],
    },
  ],
}

/** Data version 6 (rules of type "together", before the free-text note of students). */
export const LEGACY_V6 = {
  ...LEGACY_V5,
  plans: [
    {
      ...LEGACY_V5.plans[0],
      rules: [...LEGACY_V5.plans[0].rules, { id: 'r3', type: 'together', students: ['e1', 'e2'] }],
    },
  ],
}
