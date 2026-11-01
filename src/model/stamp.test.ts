import { describe, expect, it } from 'vitest'
import { stampChangedStudents } from './stamp'
import { newSchoolClass } from './types'

describe('stampChangedStudents', () => {
  const before = newSchoolClass('A', 3)
  const now = '2026-11-01T10:00:00.000Z'

  it('dates only the student that was edited', () => {
    const [a, b, c] = before.students
    const after = { ...before, students: [a, { ...b, light: 'red' as const }, c] }
    const stamped = stampChangedStudents(before, after, now)
    expect(stamped.students.map((s) => s.updatedAt === now)).toEqual([false, true, false])
  })

  it('dates a student added to the class', () => {
    const added = { ...before.students[0], id: 'new' }
    const stamped = stampChangedStudents(before, { ...before, students: [...before.students, added] }, now)
    expect(stamped.students[3].updatedAt).toBe(now)
  })

  it('returns the same class when nothing changed', () => {
    expect(stampChangedStudents(before, { ...before }, now)).toEqual(before)
  })
})
