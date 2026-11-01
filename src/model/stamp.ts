import type { SchoolClass } from './types'

/**
 * Dates the students that differ from `before` (edited or new). Store actions only return the
 * updated class, so detecting the change here keeps every one of them from stamping by hand.
 */
export function stampChangedStudents(before: SchoolClass, after: SchoolClass, now: string): SchoolClass {
  const previous = new Map(before.students.map((s) => [s.id, s]))
  const students = after.students.map((s) => (previous.get(s.id) === s ? s : { ...s, updatedAt: now }))
  return students.some((s, i) => s !== after.students[i]) ? { ...after, students } : after
}
