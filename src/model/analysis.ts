import { roomSeats } from './geometry'
import {
  fullName,
  isAesh,
  TRAFFIC_LIGHT_COLOR_NAMES as COLOR_NAME,
  type Plan,
  type Room,
  type SchoolClass,
  type TrafficLight,
} from './types'

export type Relation = 'side' | 'front' | 'diagonal' | 'aisle'
type Pos = { x: number; y: number; rotation?: number }

/** Strongest first: side-by-side matters most. */
const RANK: Record<Relation, number> = { side: 4, front: 3, diagonal: 2, aisle: 1 }
const RELATION_LABELS: Record<Relation, string> = {
  side: 'côte à côte',
  front: 'devant / derrière',
  diagonal: 'en diagonale',
  aisle: "de part et d'autre d'une allée",
}

/** Relation of `b` seen from `a`, in a's frame (the front of a seat is the direction of its rotation). */
function relationInFrame(a: Pos, b: Pos): Relation | null {
  const angle = ((a.rotation ?? 0) * Math.PI) / 180
  const vx = b.x - a.x
  const vy = b.y - a.y
  // forward = (0,-1) rotated clockwise by `angle` (y points down); right = forward rotated by 90°
  const forward = { x: Math.sin(angle), y: -Math.cos(angle) }
  const right = { x: Math.cos(angle), y: Math.sin(angle) }
  const lateral = Math.abs(vx * right.x + vy * right.y)
  const depth = Math.abs(vx * forward.x + vy * forward.y)
  if (depth <= 45 && lateral <= 130) return 'side'
  if (lateral <= 55 && depth <= 140) return 'front'
  if (lateral <= 130 && depth <= 140) return 'diagonal'
  if (depth <= 45 && lateral <= 190) return 'aisle'
  return null
}

/** Relation between two seats (the strongest of the two frames). */
export function relation(a: Pos, b: Pos): Relation | null {
  const r1 = relationInFrame(a, b)
  const r2 = relationInFrame(b, a)
  if (!r1 || !r2) return r1 ?? r2
  return RANK[r1] >= RANK[r2] ? r1 : r2
}

export type Level = 'error' | 'warning' | 'info'

export type Alert = { id: string; level: Level; message: string; studentIds: string[] }
export type Link = { a: string; b: string; type: 'conflict' | 'aesh'; level: Level }
export type Analysis = {
  alerts: Alert[]
  links: Link[]
  effectiveLight: Record<string, TrafficLight>
}

const SEVERITY: Record<TrafficLight, number> = { green: 0, orange: 1, red: 2 }
const worse = (a: TrafficLight, b: TrafficLight) => (SEVERITY[b] > SEVERITY[a] ? b : a)
/** Neighbours for a "together" rule; across an aisle is too far. */
const CLOSE = new Set<Relation>(['side', 'front', 'diagonal'])

/** True when the members form one group, each one being close to at least another one of the group. */
function isConnected(members: string[], close: (a: string, b: string) => boolean) {
  const reached = new Set([members[0]])
  const queue = [members[0]]
  for (let current = queue.shift(); current; current = queue.shift())
    for (const other of members)
      if (!reached.has(other) && close(current, other)) {
        reached.add(other)
        queue.push(other)
      }
  return reached.size === members.length
}
const levelOf = (r: Relation): Level => (r === 'side' ? 'error' : 'warning')

/** Checks a plan: rule violations, AESH constraints, and the traffic lights once neighbours are taken into account. */
export function analyze(plan: Plan, schoolClass: SchoolClass, room: Room): Analysis {
  const alerts: Alert[] = []
  const links: Link[] = []
  const byId = new Map(schoolClass.students.map((s) => [s.id, s]))
  const seats = new Map(roomSeats(room).map((s) => [s.seatId, s]))
  const positions = new Map<string, Pos>()
  for (const [seatId, studentId] of Object.entries(plan.assignments)) {
    const seat = seats.get(seatId)
    if (seat && byId.has(studentId)) positions.set(studentId, seat)
  }
  const name = (id: string) => fullName(byId.get(id)!)

  const placed = [...positions.keys()]
  const relations = new Map<string, Relation>()
  const keyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const r = relation(positions.get(placed[i])!, positions.get(placed[j])!)
      if (r) relations.set(keyOf(placed[i], placed[j]), r)
    }
  const relationBetween = (a: string, b: string) => relations.get(keyOf(a, b))

  // Effective traffic light: influence can only make it worse.
  const effectiveLight: Record<string, TrafficLight> = {}
  for (const id of placed) {
    const student = byId.get(id)!
    if (!isAesh(student)) effectiveLight[id] = student.light
  }
  for (const rule of plan.rules) {
    if (rule.type !== 'influence' || !positions.has(rule.student) || !positions.has(rule.near)) continue
    const rel = relationBetween(rule.student, rule.near)
    if (rel !== 'side' && rel !== 'front') continue
    const before = effectiveLight[rule.student]
    effectiveLight[rule.student] = worse(before, rule.becomes)
    if (effectiveLight[rule.student] !== before)
      alerts.push({
        id: `influence-${rule.id}`,
        level: 'info',
        message: `${name(rule.student)} devient ${COLOR_NAME[effectiveLight[rule.student]]} près de ${name(rule.near)}`,
        studentIds: [rule.student, rule.near],
      })
  }

  const conflict = (id: string, a: string, b: string, rel: Relation, message: string) => {
    alerts.push({ id, level: levelOf(rel), message: `${message} (${RELATION_LABELS[rel]})`, studentIds: [a, b] })
    links.push({ a, b, type: 'conflict', level: levelOf(rel) })
  }

  for (const rule of plan.rules) {
    if (rule.type === 'separate') {
      const rel = relationBetween(rule.studentA, rule.studentB)
      if (rel)
        conflict(
          `separate-${rule.id}`,
          rule.studentA,
          rule.studentB,
          rel,
          `${name(rule.studentA)} et ${name(rule.studentB)} doivent être séparés`,
        )
    } else if (rule.type === 'together') {
      // Members who are not placed are already listed as "to place": only the placed ones can be judged.
      const members = rule.students.filter((id) => positions.has(id))
      if (members.length >= 2 && !isConnected(members, (a, b) => CLOSE.has(relationBetween(a, b) as Relation)))
        alerts.push({
          id: `together-${rule.id}`,
          level: 'warning',
          message: `${members.map(name).join(', ')} devraient être proches`,
          studentIds: members,
        })
    } else if (rule.type === 'colors') {
      const ids = placed.filter((id) => effectiveLight[id])
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const [la, lb] = [effectiveLight[ids[i]], effectiveLight[ids[j]]]
          const matches = (la === rule.a && lb === rule.b) || (la === rule.b && lb === rule.a)
          const rel = matches && relationBetween(ids[i], ids[j])
          if (rel)
            conflict(
              `colors-${rule.id}-${ids[i]}-${ids[j]}`,
              ids[i],
              ids[j],
              rel,
              `${rule.a === rule.b ? `Deux ${COLOR_NAME[rule.a]}s` : `${COLOR_NAME[rule.a]} et ${COLOR_NAME[rule.b]}`} : ${name(ids[i])} et ${name(ids[j])}`,
            )
        }
    }
  }

  for (const aesh of schoolClass.students.filter(isAesh)) {
    const supported = aesh.supports.filter((id) => byId.has(id))
    if (!positions.has(aesh.id)) {
      alerts.push({
        id: `aesh-unplaced-${aesh.id}`,
        level: 'warning',
        message: `AESH ${fullName(aesh)} n'est pas placé(e)${supported.length ? ` (accompagne ${supported.map(name).join(', ')})` : ''}`,
        studentIds: [aesh.id],
      })
      continue
    }
    if (!supported.length)
      alerts.push({
        id: `aesh-idle-${aesh.id}`,
        level: 'info',
        message: `AESH ${fullName(aesh)} n'a pas d'élève à accompagner`,
        studentIds: [aesh.id],
      })
    for (const id of supported) {
      if (!positions.has(id)) continue // an unplaced student is already visible in the "to place" list
      if (relationBetween(aesh.id, id)) links.push({ a: aesh.id, b: id, type: 'aesh', level: 'info' })
      else
        alerts.push({
          id: `aesh-far-${aesh.id}-${id}`,
          level: 'error',
          message: `AESH ${fullName(aesh)} est trop loin de ${name(id)}`,
          studentIds: [aesh.id, id],
        })
    }
  }

  const order: Record<Level, number> = { error: 0, warning: 1, info: 2 }
  alerts.sort((x, y) => order[x.level] - order[y.level])
  return { alerts, links, effectiveLight }
}
