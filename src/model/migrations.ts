/* lang-ignore-file: the migrations read data written with French field names */
/**
 * Version of the DATA format (classes, rooms, plans), shared by the local database and `.classe`
 * files. Bump it whenever the shape changes and add the matching `n → n+1` migration below.
 *
 *  1: first version (classes with tags/rules, simple plans)
 *  2: V2 — traffic light, AESH, gender, annotations; rules, status and notes per plan
 *  3: English field and value names (`salles` → `rooms`, `eleves` → `students`, …)
 *  4: V3 — students can be class representatives (`delegate`)
 *  5: V4 — students can be deputy class representatives (`deputy`)
 *  6: rules of type `together` (older releases would silently drop them)
 *  7: free-text `note` on students
 */
export const DATA_VERSION = 7

/** Data as read from storage or from a file, in whatever shape its version used. */
export type RawData = {
  classes: unknown[]
  plans: unknown[]
  rooms?: unknown[]
  /** Legacy name of `rooms`, used by data versions 1 and 2. */
  salles?: unknown[]
}

/** Data in the current shape. */
export type Data = { classes: unknown[]; rooms: unknown[]; plans: unknown[] }

/** Puts the rooms under the key their data version used. */
export function toRawData(version: number, data: { classes: unknown[]; rooms: unknown[]; plans: unknown[] }): RawData {
  const { rooms, ...rest } = data
  return version < 3 ? { ...rest, salles: rooms } : { ...rest, rooms }
}

// French → English values, for the 2 → 3 migration.
const LIGHTS: Record<string, string> = { vert: 'green', orange: 'orange', rouge: 'red' }
const GENDERS: Record<string, string> = { fille: 'girl', garcon: 'boy' }
const ROLES: Record<string, string> = { eleve: 'student', aesh: 'aesh' }
const FURNITURE_TYPES: Record<string, string> = {
  individuelle: 'single',
  double: 'double',
  ilot: 'island',
  chaise: 'chair',
  prof: 'teacher',
}
const STATUSES: Record<string, string> = {
  brouillon: 'draft',
  en_test: 'testing',
  retenu: 'adopted',
  abandonne: 'abandoned',
}
const RULE_TYPES: Record<string, string> = { separer: 'separate', couleurs: 'colors', influence: 'influence' }
const translate = (table: Record<string, string>, value: unknown) =>
  typeof value === 'string' ? (table[value] ?? value) : value

/* eslint-disable @typescript-eslint/no-explicit-any -- migrations read data of shapes that no longer exist */
const MIGRATIONS: Record<number, (d: RawData) => RawData> = {
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

  2: (d) => ({
    classes: (d.classes as any[]).map((c) => ({
      id: c.id,
      name: c.nom,
      students: (c.eleves ?? []).map((e: any) => ({
        id: e.id,
        firstName: e.prenom,
        lastName: e.nom,
        photoId: e.photoId,
        annotations: e.annotations,
        light: translate(LIGHTS, e.feu),
        gender: translate(GENDERS, e.genre),
        role: translate(ROLES, e.role),
        supports: e.accompagne,
      })),
    })),
    rooms: ((d.salles ?? []) as any[]).map((s) => ({
      id: s.id,
      name: s.nom,
      width: s.largeur,
      height: s.hauteur,
      grid: s.grille,
      furniture: (s.meubles ?? []).map((m: any) => ({
        id: m.id,
        type: translate(FURNITURE_TYPES, m.type),
        x: m.x,
        y: m.y,
        rotation: m.rotation,
        width: m.largeur,
        height: m.hauteur,
        seats: m.places,
      })),
    })),
    plans: (d.plans as any[]).map((p) => ({
      id: p.id,
      name: p.nom,
      classId: p.classeId,
      roomId: p.salleId,
      assignments: p.affectations,
      rules: (p.regles ?? []).map((r: any) => {
        const type = translate(RULE_TYPES, r.type)
        if (type === 'separate') return { id: r.id, type, studentA: r.eleveA, studentB: r.eleveB }
        if (type === 'colors') return { id: r.id, type, a: translate(LIGHTS, r.a), b: translate(LIGHTS, r.b) }
        return { id: r.id, type, student: r.eleve, near: r.avec, becomes: translate(LIGHTS, r.devient) }
      }),
      status: translate(STATUSES, p.statut),
      notes: p.notes,
      parentId: p.parentId,
      createdAt: p.creeLe,
      testingSince: p.testeDepuis,
    })),
  }),

  3: (d) => ({
    classes: (d.classes as any[]).map((c) => ({
      ...c,
      students: (c.students ?? []).map((s: any) => ({ ...s, delegate: false })),
    })),
    rooms: d.rooms,
    plans: d.plans,
  }),

  4: (d) => ({
    classes: (d.classes as any[]).map((c) => ({
      ...c,
      students: (c.students ?? []).map((s: any) => ({ ...s, deputy: false })),
    })),
    rooms: d.rooms,
    plans: d.plans,
  }),

  // Only a new kind of rule: nothing to rewrite. The bump makes older builds refuse the data instead of dropping it.
  5: (d) => d,

  6: (d) => ({
    classes: (d.classes as any[]).map((c) => ({
      ...c,
      students: (c.students ?? []).map((s: any) => ({ ...s, note: '' })),
    })),
    rooms: d.rooms,
    plans: d.plans,
  }),
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Runs the migrations from version `from` up to the current one. */
export function migrate(raw: RawData, from: number): Data {
  let d = raw
  for (let v = from; v < DATA_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) throw new Error(`Missing migration ${v} → ${v + 1}.`)
    d = step(d)
  }
  return { classes: d.classes, rooms: d.rooms ?? [], plans: d.plans }
}
