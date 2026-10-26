import { roomSeats } from './geometry'
import type { Plan, Room, Rule, SchoolClass } from './types'

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

/** Randomly spreads the unplaced students over the free seats (in reading order). */
export function fillRandomly(plan: Plan, schoolClass: SchoolClass, room: Room, rng = Math.random) {
  const assignments = { ...plan.assignments }
  const freeSeats = roomSeats(room)
    .map((s) => s.seatId)
    .filter((id) => !assignments[id])
  const placed = new Set(Object.values(assignments))
  const remaining = schoolClass.students.map((s) => s.id).filter((id) => !placed.has(id))
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
  }
  freeSeats.forEach((seatId, i) => {
    if (remaining[i]) assignments[seatId] = remaining[i]
  })
  return assignments
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
