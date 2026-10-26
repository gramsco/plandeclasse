export type TrafficLight = 'green' | 'orange' | 'red'
export const TRAFFIC_LIGHTS: TrafficLight[] = ['green', 'orange', 'red']
export const TRAFFIC_LIGHT_LABELS: Record<TrafficLight, string> = {
  green: 'Sympa',
  orange: 'À surveiller',
  red: 'Perturbateur',
}

/** French colour names, for messages shown to the user (the values themselves are English). */
export const TRAFFIC_LIGHT_COLOR_NAMES: Record<TrafficLight, string> = { green: 'vert', orange: 'orange', red: 'rouge' }

export type Rule =
  | { id: string; type: 'separate'; studentA: string; studentB: string }
  | { id: string; type: 'colors'; a: TrafficLight; b: TrafficLight }
  | { id: string; type: 'influence'; student: string; near: string; becomes: TrafficLight }

export type Gender = 'girl' | 'boy'
export const GENDER_LABELS: Record<Gender, string> = { girl: 'fille', boy: 'garçon' }

/** A student, or an AESH (role = 'aesh', a classroom aide) who supports some students. */
export type Student = {
  id: string
  firstName: string
  lastName: string
  photoId?: string
  annotations: string[] // free-form labels such as PAP, PPS, DYS…
  light: TrafficLight
  gender?: Gender // unset until the user picks one
  delegate: boolean // class representative (shown with a gold crown)
  deputy: boolean // deputy class representative (silver crown); a student is never both
  role: 'student' | 'aesh'
  supports: string[] // ids of the students an AESH supports
}

/** A school class is a list of people, independent of any physical room. */
export type SchoolClass = {
  id: string
  name: string
  students: Student[]
}

/** Offset from the centre of the (unrotated) furniture. */
export type Seat = { id: string; dx: number; dy: number }

export type FurnitureType = 'single' | 'double' | 'island' | 'chair' | 'teacher'
export type Rotation = 0 | 90 | 180 | 270

export type Furniture = {
  id: string
  type: FurnitureType
  x: number // top-left corner of the unrotated furniture
  y: number
  rotation: Rotation
  width: number
  height: number
  seats: Seat[]
}

/** A room is a physical place: furniture and seats. */
export type Room = {
  id: string
  name: string
  width: number
  height: number
  grid: number
  furniture: Furniture[]
}

export type PlanStatus = 'draft' | 'testing' | 'adopted' | 'abandoned'
export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: 'Hypothèse',
  testing: 'En test',
  adopted: 'Retenu',
  abandoned: 'Abandonné',
}

/** A plan puts a school class in a room. It is also a hypothesis to try out in real life. */
export type Plan = {
  id: string
  name: string
  classId: string
  roomId: string
  assignments: Record<string, string> // seatId -> studentId
  rules: Rule[]
  status: PlanStatus
  notes: string
  parentId?: string
  createdAt: string
  testingSince?: string
}

export const newId = () => crypto.randomUUID()

export const newStudent = (firstName: string, lastName = ''): Student => ({
  id: newId(),
  firstName,
  lastName,
  annotations: [],
  light: 'green',
  delegate: false,
  deputy: false,
  role: 'student',
  supports: [],
})

export const newAesh = (firstName: string, lastName = ''): Student => ({
  ...newStudent(firstName, lastName),
  role: 'aesh',
})

export const newSchoolClass = (name: string, studentCount = 0): SchoolClass => ({
  id: newId(),
  name,
  students: Array.from({ length: studentCount }, (_, i) => newStudent(`Élève ${i + 1}`)),
})

/** Common annotations offered in the UI (label → meaning). */
export const COMMON_ANNOTATIONS: Record<string, string> = {
  PAP: "Plan d'accompagnement personnalisé",
  PPS: 'Projet personnalisé de scolarisation',
  PAI: "Projet d'accueil individualisé",
  PPRE: 'Programme personnalisé de réussite éducative',
  DYS: 'Troubles « dys »',
  HPI: 'Haut potentiel intellectuel',
  UPE2A: 'Élève allophone',
  TDAH: "Trouble de l'attention",
}

export const isAesh = (s: Student) => s.role === 'aesh'
export const fullName = (s: Student) => `${s.firstName} ${s.lastName}`.trim()

// ---- Normalisation: fills in defaults for data coming from older versions or imported files ----
// These accept any input on purpose: they are the boundary with untrusted persisted data.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const normalizeStudent = (s: any): Student => ({
  id: String(s.id),
  firstName: String(s.firstName ?? ''),
  lastName: String(s.lastName ?? ''),
  photoId: s.photoId ? String(s.photoId) : undefined,
  annotations: Array.isArray(s.annotations) ? s.annotations.map(String) : [],
  light: TRAFFIC_LIGHTS.includes(s.light) ? s.light : 'green',
  gender: s.gender === 'girl' || s.gender === 'boy' ? s.gender : undefined,
  delegate: s.delegate === true,
  deputy: s.deputy === true && s.delegate !== true,
  role: s.role === 'aesh' ? 'aesh' : 'student',
  supports: Array.isArray(s.supports) ? s.supports : [],
})

export const normalizeClass = (c: any): SchoolClass => ({
  id: String(c.id),
  name: String(c.name ?? 'Classe'),
  students: (c.students ?? []).map(normalizeStudent),
})

export const normalizeRoom = (r: any): Room => ({
  id: String(r.id),
  name: String(r.name ?? 'Salle'),
  width: Number(r.width) || 1200,
  height: Number(r.height) || 800,
  grid: Number(r.grid) || 10,
  furniture: Array.isArray(r.furniture) ? r.furniture : [],
})

export const normalizePlan = (p: any): Plan => ({
  id: String(p.id),
  name: String(p.name ?? 'Plan'),
  classId: String(p.classId),
  roomId: String(p.roomId),
  assignments: p.assignments && typeof p.assignments === 'object' ? p.assignments : {},
  rules: Array.isArray(p.rules)
    ? p.rules.filter((r: any) => r && ['separate', 'colors', 'influence'].includes(r.type))
    : [],
  status: p.status in PLAN_STATUS_LABELS ? p.status : 'draft',
  notes: String(p.notes ?? ''),
  parentId: p.parentId ? String(p.parentId) : undefined,
  createdAt: String(p.createdAt ?? new Date().toISOString()),
  testingSince: p.testingSince ? String(p.testingSince) : undefined,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

/** One student per line: "First Last" or "Last, First". */
export function parseStudentList(text: string): Student[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes(',')) {
        const [lastName, ...rest] = line.split(',')
        return newStudent(rest.join(',').trim(), lastName.trim())
      }
      const [firstName, ...rest] = line.split(/\s+/)
      return newStudent(firstName, rest.join(' '))
    })
}
