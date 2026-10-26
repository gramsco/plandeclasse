import { relation, type Relation } from './analysis'
import { roomSeats } from './geometry'
import { isAesh, type Plan, type Room, type Rule, type SchoolClass, type Student } from './types'

/** Drops assignments that became invalid (seat or student gone, duplicate student). */
export function purgeAssignments(plan: Plan, schoolClass: SchoolClass | undefined, room: Room | undefined) {
  const seats = new Set(room?.furniture.flatMap((f) => f.seats.map((s) => s.id)))
  const students = new Set(schoolClass?.students.map((s) => s.id))
  const seen = new Set<string>()
  const result: Record<string, string> = {}
  for (const [seatId, studentId] of Object.entries(plan.assignments)) {
    if (seats.has(seatId) && students.has(studentId) && !seen.has(studentId)) {
      result[seatId] = studentId
      seen.add(studentId)
    }
  }
  return result
}

/** Puts a student on a seat (or removes them if seatId is null); swaps with the occupant if any. */
export function assign(assignments: Record<string, string>, studentId: string, seatId: string | null) {
  const result = { ...assignments }
  const previous = Object.keys(result).find((k) => result[k] === studentId)
  if (previous) delete result[previous]
  if (seatId) {
    const occupant = result[seatId]
    result[seatId] = studentId
    if (occupant && previous) result[previous] = occupant
  }
  return result
}

export type FillStrategy = 'random' | 'alternate-gender' | 'spread-lights'

export const FILL_STRATEGY_LABELS: Record<FillStrategy, string> = {
  random: 'Au hasard',
  'alternate-gender': 'Alterner filles / garçons',
  'spread-lights': 'Répartir les couleurs (tricolore)',
}

const NEIGHBOUR_WEIGHT: Record<Relation, number> = { side: 3, front: 2, diagonal: 1, aisle: 0 }
const LIGHT_SEVERITY = { green: 0, orange: 1, red: 2 }

/** How bad it is to sit `a` next to `b` for the strategy (0 = fine). AESH never count. */
function clash(strategy: FillStrategy, a: Student, b: Student): number {
  if (isAesh(a) || isAesh(b)) return 0
  if (strategy === 'alternate-gender') return a.gender && a.gender === b.gender ? 1 : 0
  if (strategy === 'spread-lights') return LIGHT_SEVERITY[a.light] * LIGHT_SEVERITY[b.light]
  return 0
}

/**
 * Spreads the unplaced students over the free seats. `random` shuffles; the other strategies place
 * seat after seat (in reading order) the student who clashes least with the neighbours already seated.
 */
export function fillRandomly(
  plan: Plan,
  schoolClass: SchoolClass,
  room: Room,
  rng = Math.random,
  strategy: FillStrategy = 'random',
) {
  const assignments = { ...plan.assignments }
  const seats = roomSeats(room)
  const freeSeats = seats.filter((s) => !assignments[s.seatId])
  const placed = new Set(Object.values(assignments))
  const remaining = schoolClass.students.filter((s) => !placed.has(s.id))
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
  }
  if (strategy === 'random') {
    freeSeats.forEach((seat, i) => {
      if (remaining[i]) assignments[seat.seatId] = remaining[i].id
    })
    return assignments
  }

  const byId = new Map(schoolClass.students.map((s) => [s.id, s]))
  const neighbours = new Map(
    seats.map((seat) => [
      seat.seatId,
      seats.flatMap((other) => {
        const weight = other === seat ? 0 : NEIGHBOUR_WEIGHT[relation(seat, other) ?? 'aisle']
        return weight ? [{ seatId: other.seatId, weight }] : []
      }),
    ]),
  )
  /** How much `student` clashes with the people currently around `seatId`. */
  const cost = (seatId: string, student: Student) =>
    neighbours.get(seatId)!.reduce((sum, n) => {
      const other = byId.get(assignments[n.seatId])
      return other ? sum + n.weight * clash(strategy, student, other) : sum
    }, 0)

  // Seat after seat, take the student who clashes least with those already seated…
  for (const seat of freeSeats) {
    if (!remaining.length) break
    let best = 0
    let bestCost = cost(seat.seatId, remaining[0])
    for (let i = 1; i < remaining.length; i++) {
      const c = cost(seat.seatId, remaining[i])
      if (c < bestCost) [best, bestCost] = [i, c]
    }
    assignments[seat.seatId] = remaining.splice(best, 1)[0].id
  }
  // …then swap pairs of newly seated students for as long as that helps.
  const seated = freeSeats.map((s) => s.seatId).filter((id) => assignments[id])
  for (let pass = 0, improved = true; improved && pass < 20; pass++) {
    improved = false
    for (let i = 0; i < seated.length; i++)
      for (let j = i + 1; j < seated.length; j++) {
        const [x, y] = [assignments[seated[i]], assignments[seated[j]]]
        const before = cost(seated[i], byId.get(x)!) + cost(seated[j], byId.get(y)!)
        ;[assignments[seated[i]], assignments[seated[j]]] = [y, x]
        const after = cost(seated[i], byId.get(y)!) + cost(seated[j], byId.get(x)!)
        if (after < before) improved = true
        else [assignments[seated[i]], assignments[seated[j]]] = [x, y]
      }
  }
  return assignments
}

/**
 * Carries the assignments of a plan over to another room, as well as possible: seats are matched by
 * their relative position in the room (nearest first). Students left without a seat stay unplaced.
 */
export function transposeAssignments(assignments: Record<string, string>, from: Room, to: Room) {
  const normalise = (room: Room) => {
    const seats = roomSeats(room)
    const xs = seats.map((s) => s.x)
    const ys = seats.map((s) => s.y)
    const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
    const [spanX, spanY] = [Math.max(...xs) - minX || 1, Math.max(...ys) - minY || 1]
    return seats.map((s) => ({ seatId: s.seatId, x: (s.x - minX) / spanX, y: (s.y - minY) / spanY }))
  }
  const sources = normalise(from).filter((s) => assignments[s.seatId])
  const targets = normalise(to)
  const pairs = sources
    .flatMap((a) => targets.map((b) => ({ from: a.seatId, to: b.seatId, distance: Math.hypot(a.x - b.x, a.y - b.y) })))
    .sort((p, q) => p.distance - q.distance)
  const result: Record<string, string> = {}
  const usedSources = new Set<string>()
  for (const pair of pairs) {
    if (usedSources.has(pair.from) || result[pair.to]) continue
    usedSources.add(pair.from)
    result[pair.to] = assignments[pair.from]
  }
  return result
}

/** Drops the rules that mention a student who no longer exists. */
export function purgeRules(rules: Rule[], schoolClass: SchoolClass | undefined): Rule[] {
  const ids = new Set(schoolClass?.students.map((s) => s.id))
  return rules.filter((r) => {
    if (r.type === 'separate') return ids.has(r.studentA) && ids.has(r.studentB)
    if (r.type === 'influence') return ids.has(r.student) && ids.has(r.near)
    return true
  })
}
