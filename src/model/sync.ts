import { DATA_VERSION } from './migrations'
import { normalizePlan, normalizeStudent, type Plan, type Room, type SchoolClass, type Student } from './types'

/** Identifies a patch among other JSON (and among the pages a QR code may point to). */
export const PATCH_FORMAT = 'classe-patch'

/**
 * The edits made on one device since a given moment, to be merged into another. Photos are left out
 * (heavy, and never edited on the phone), and so is creation or deletion: only what already exists
 * on both sides can be updated.
 */
export type Patch = {
  format: typeof PATCH_FORMAT
  version: number
  createdAt: string
  students: { classId: string; student: Student }[]
  plans: Plan[]
}

export function buildPatch(classes: SchoolClass[], plans: Plan[], since: string, now: string): Patch {
  return {
    format: PATCH_FORMAT,
    version: DATA_VERSION,
    createdAt: now,
    students: classes.flatMap((c) =>
      c.students
        .filter((s) => s.updatedAt > since)
        .map(({ photoId: _photo, ...student }) => ({ classId: c.id, student })),
    ),
    plans: plans.filter((p) => p.updatedAt > since),
  }
}

const INVALID = 'Ces modifications ne sont pas valides.'

/** Validates a patch read from a QR code or a file. Throws a user-readable Error if it is not one. */
export function parsePatch(text: string): Patch {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(INVALID)
  }
  if (!raw || typeof raw !== 'object' || raw.format !== PATCH_FORMAT) throw new Error(INVALID)
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) throw new Error(INVALID)
  if (raw.version > DATA_VERSION)
    throw new Error(
      'Ces modifications viennent d’une version plus récente de l’application. Rechargez la page ou mettez l’application à jour.',
    )
  // A patch only exists in the current shape: an older one would need the migrations, and none was ever issued.
  if (raw.version < DATA_VERSION)
    throw new Error(
      'Ces modifications viennent d’une version plus ancienne de l’application. Mettez-la à jour puis recommencez.',
    )
  if (!Array.isArray(raw.students) || !Array.isArray(raw.plans)) throw new Error(INVALID)

  const hasId = (x: unknown): x is { id: string } =>
    !!x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string'
  const students = raw.students.flatMap((entry: unknown) => {
    const e = entry as { classId?: unknown; student?: unknown }
    return e && typeof e.classId === 'string' && hasId(e.student)
      ? [{ classId: e.classId, student: normalizeStudent(e.student) }]
      : []
  })
  const plans = raw.plans.filter(hasId).map(normalizePlan)
  return {
    format: PATCH_FORMAT,
    version: raw.version,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    students,
    plans,
  }
}

/** What differs, as field names: the UI turns them into words. */
export type StudentField = Exclude<keyof Student, 'id' | 'photoId' | 'updatedAt'>
export type PlanField = Exclude<keyof Plan, 'id' | 'classId' | 'roomId' | 'createdAt' | 'updatedAt'>

export type Change =
  | { kind: 'student'; classId: string; student: Student; fields: StudentField[] }
  | { kind: 'plan'; plan: Plan; fields: PlanField[]; moved: number }

export const STUDENT_FIELD_LABELS: Record<StudentField, string> = {
  firstName: 'prénom',
  lastName: 'nom',
  annotations: 'annotations',
  note: 'note',
  light: 'feu tricolore',
  gender: 'genre',
  delegate: 'délégué',
  deputy: 'délégué suppléant',
  role: 'rôle',
  supports: 'élèves accompagnés',
}

export const PLAN_FIELD_LABELS: Record<PlanField, string> = {
  name: 'nom',
  assignments: 'placement',
  rules: 'règles',
  status: 'statut',
  notes: 'notes',
  parentId: "plan d'origine",
  testingSince: 'début du test',
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const STUDENT_FIELDS: StudentField[] = [
  'firstName',
  'lastName',
  'annotations',
  'note',
  'light',
  'gender',
  'delegate',
  'deputy',
  'role',
  'supports',
]
const PLAN_FIELDS: PlanField[] = ['name', 'assignments', 'rules', 'status', 'notes', 'parentId', 'testingSince']

/** Seats whose occupant is not the same in both plans. */
const movedSeats = (a: Plan['assignments'], b: Plan['assignments']) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((seat) => a[seat] !== b[seat]).length

/**
 * What applying the patch would change here. Anything that is not newer than the local copy, that does
 * not exist here, or that is identical, is left out: the patch never creates, deletes or goes back in time.
 */
export function diffPatch(patch: Patch, classes: SchoolClass[], plans: Plan[]): Change[] {
  const changes: Change[] = []
  for (const { classId, student } of patch.students) {
    const local = classes.find((c) => c.id === classId)?.students.find((s) => s.id === student.id)
    if (!local || student.updatedAt <= local.updatedAt) continue
    const fields = STUDENT_FIELDS.filter((f) => !same(local[f], student[f]))
    if (fields.length) changes.push({ kind: 'student', classId, student, fields })
  }
  for (const plan of patch.plans) {
    const local = plans.find((p) => p.id === plan.id)
    if (!local || plan.updatedAt <= local.updatedAt) continue
    const fields = PLAN_FIELDS.filter((f) => !same(local[f], plan[f]))
    if (fields.length)
      changes.push({ kind: 'plan', plan, fields, moved: movedSeats(local.assignments, plan.assignments) })
  }
  return changes
}

/** Applies the changes the teacher accepted. The date of the edit travels with it. */
export function applyChanges(
  classes: SchoolClass[],
  plans: Plan[],
  changes: Change[],
): { classes: SchoolClass[]; plans: Plan[] } {
  return {
    classes: classes.map((c) => ({
      ...c,
      students: c.students.map((s) => {
        const change = changes.find((x) => x.kind === 'student' && x.classId === c.id && x.student.id === s.id)
        return change?.kind === 'student' ? { ...change.student, photoId: s.photoId } : s
      }),
    })),
    plans: plans.map((p) => {
      const change = changes.find((x) => x.kind === 'plan' && x.plan.id === p.id)
      return change?.kind === 'plan'
        ? { ...change.plan, classId: p.classId, roomId: p.roomId, createdAt: p.createdAt }
        : p
    }),
  }
}

export type Bundle = { classes: SchoolClass[]; rooms: Room[]; plans: Plan[] }

/**
 * What to send to set up a new device with some classes: the classes, their plans and the rooms those
 * use. Photos are left out, so the students lose their `photoId` rather than point at nothing.
 */
export function selectBundle(data: Bundle, classIds: string[]): Bundle {
  const classes = data.classes
    .filter((c) => classIds.includes(c.id))
    .map((c) => ({ ...c, students: c.students.map(({ photoId: _photo, ...student }) => student) }))
  const plans = data.plans.filter((p) => classIds.includes(p.classId))
  const roomIds = new Set(plans.map((p) => p.roomId))
  return { classes, plans, rooms: data.rooms.filter((r) => roomIds.has(r.id)) }
}

/** A class this device does not have yet, with its plans and the rooms they need that are missing too. */
export type Newcomer = { schoolClass: SchoolClass; plans: Plan[]; rooms: Room[] }

/**
 * The classes of `incoming` unknown here. A class that already exists is never touched: its edits
 * travel as a patch, which knows which side is newer.
 */
export function newcomers(incoming: Bundle, local: Bundle): Newcomer[] {
  return incoming.classes
    .filter((c) => !local.classes.some((l) => l.id === c.id))
    .map((schoolClass) => {
      const plans = incoming.plans.filter(
        (p) => p.classId === schoolClass.id && !local.plans.some((l) => l.id === p.id),
      )
      const roomIds = new Set(plans.map((p) => p.roomId))
      const rooms = incoming.rooms.filter((r) => roomIds.has(r.id) && !local.rooms.some((l) => l.id === r.id))
      return { schoolClass, plans, rooms }
    })
}

/** Gathers the accepted newcomers into one bundle; a room needed by two classes is listed once. */
export function bundleOf(accepted: Newcomer[]): Bundle {
  const rooms = new Map(accepted.flatMap((n) => n.rooms).map((r) => [r.id, r]))
  return {
    classes: accepted.map((n) => n.schoolClass),
    plans: accepted.flatMap((n) => n.plans),
    rooms: [...rooms.values()],
  }
}
