import { describe, expect, it } from 'vitest'
import { DATA_VERSION } from './migrations'
import { applyChanges, buildPatch, diffPatch, parsePatch } from './sync'
import { newSchoolClass, type Plan, type SchoolClass } from './types'

const T1 = '2026-11-01T08:00:00.000Z'
const T2 = '2026-11-01T09:00:00.000Z'
const T3 = '2026-11-01T10:00:00.000Z'

const makePlan = (assignments: Record<string, string>, updatedAt: string): Plan => ({
  id: 'p1',
  name: 'Plan',
  classId: 'c1',
  roomId: 'r1',
  assignments,
  rules: [],
  status: 'draft',
  notes: '',
  createdAt: T1,
  updatedAt,
})

const makeClass = (): SchoolClass => {
  const c = newSchoolClass('A', 2)
  return { ...c, id: 'c1', students: c.students.map((s) => ({ ...s, updatedAt: T1, photoId: `photo-${s.id}` })) }
}

/** The phone edits a copy of the desktop's data, as after a first sync. */
const editOnPhone = () => {
  const desktop = { classes: [makeClass()], plans: [makePlan({ s1: 'a', s2: 'b' }, T1)] }
  const [a, b] = desktop.classes[0].students
  const phone = {
    classes: [{ ...desktop.classes[0], students: [{ ...a, light: 'red' as const, updatedAt: T2 }, b] }],
    plans: [makePlan({ s1: 'b', s2: 'a' }, T2)],
  }
  return { desktop, phone, edited: a }
}

describe('sync patches', () => {
  it('carries only what was edited since the last sync, without photos', () => {
    const { phone, edited } = editOnPhone()
    const patch = buildPatch(phone.classes, phone.plans, T1, T3)
    expect(patch.students).toHaveLength(1)
    expect(patch.students[0]).toMatchObject({ classId: 'c1', student: { id: edited.id, light: 'red' } })
    expect(patch.students[0].student.photoId).toBeUndefined()
    expect(patch.plans).toHaveLength(1)
  })

  it('is empty when nothing was edited', () => {
    const { desktop } = editOnPhone()
    const patch = buildPatch(desktop.classes, desktop.plans, T1, T3)
    expect(patch.students).toEqual([])
    expect(patch.plans).toEqual([])
  })

  it('survives the trip through JSON', () => {
    const { phone } = editOnPhone()
    const patch = buildPatch(phone.classes, phone.plans, T1, T3)
    expect(parsePatch(JSON.stringify(patch))).toEqual(patch)
  })

  it('reports what would change on the desktop, then applies it and keeps the photos', () => {
    const { desktop, phone, edited } = editOnPhone()
    const patch = parsePatch(JSON.stringify(buildPatch(phone.classes, phone.plans, T1, T3)))
    const changes = diffPatch(patch, desktop.classes, desktop.plans)
    expect(changes).toEqual([
      { kind: 'student', classId: 'c1', student: expect.objectContaining({ id: edited.id }), fields: ['light'] },
      { kind: 'plan', plan: expect.objectContaining({ id: 'p1' }), fields: ['assignments'], moved: 2 },
    ])

    const merged = applyChanges(desktop.classes, desktop.plans, changes)
    expect(merged.classes[0].students[0]).toMatchObject({ light: 'red', updatedAt: T2, photoId: edited.photoId })
    expect(merged.classes[0].students[1]).toBe(desktop.classes[0].students[1])
    expect(merged.plans[0].assignments).toEqual({ s1: 'b', s2: 'a' })
  })

  it('applies only the changes the teacher accepted', () => {
    const { desktop, phone } = editOnPhone()
    const patch = buildPatch(phone.classes, phone.plans, T1, T3)
    const [studentChange] = diffPatch(patch, desktop.classes, desktop.plans)
    const merged = applyChanges(desktop.classes, desktop.plans, [studentChange])
    expect(merged.classes[0].students[0].light).toBe('red')
    expect(merged.plans[0]).toBe(desktop.plans[0])
  })

  it('ignores edits older than the desktop copy, identical ones, and things that do not exist here', () => {
    const { desktop, phone } = editOnPhone()
    const patch = buildPatch(phone.classes, phone.plans, T1, T3)
    const newer = {
      classes: [{ ...desktop.classes[0], students: desktop.classes[0].students.map((s) => ({ ...s, updatedAt: T3 })) }],
      plans: [{ ...desktop.plans[0], updatedAt: T3 }],
    }
    expect(diffPatch(patch, newer.classes, newer.plans)).toEqual([])
    expect(diffPatch(patch, phone.classes, phone.plans)).toEqual([])
    expect(diffPatch(patch, [], [])).toEqual([])
  })

  it('refuses what is not a patch, and patches from another data version', () => {
    expect(() => parsePatch('nope')).toThrow('pas valides')
    expect(() => parsePatch(JSON.stringify({ format: 'classe', version: DATA_VERSION }))).toThrow('pas valides')
    expect(() => parsePatch(JSON.stringify({ format: 'classe-patch', version: DATA_VERSION + 1 }))).toThrow(
      'plus récente',
    )
    expect(() =>
      parsePatch(JSON.stringify({ format: 'classe-patch', version: DATA_VERSION - 1, students: [], plans: [] })),
    ).toThrow('plus ancienne')
  })

  it('drops malformed entries instead of inventing data', () => {
    const text = JSON.stringify({
      format: 'classe-patch',
      version: DATA_VERSION,
      createdAt: T3,
      students: [{ classId: 'c1', student: { firstName: 'no id' } }, { student: { id: 'x' } }, 7],
      plans: [{ name: 'no id' }, null],
    })
    const patch = parsePatch(text)
    expect(patch.students).toEqual([])
    expect(patch.plans).toEqual([])
  })
})
