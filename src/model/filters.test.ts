import { describe, expect, it } from 'vitest'
import { matchesFilter, ruleStudentIds } from './filters'
import { newAesh, newSchoolClass, type Rule } from './types'

describe('student filters', () => {
  const schoolClass = newSchoolClass('A', 3)
  const [ada, bob, carl] = schoolClass.students
  Object.assign(ada, { delegate: true, gender: 'girl', light: 'red' })
  Object.assign(bob, { gender: 'boy', light: 'orange' })
  const aesh = newAesh('Sam')

  it('matches delegates, genders and the AESH', () => {
    expect(matchesFilter(ada, 'delegate')).toBe(true)
    expect(matchesFilter(bob, 'delegate')).toBe(false)
    expect(matchesFilter(ada, 'girl')).toBe(true)
    expect(matchesFilter(carl, 'girl')).toBe(false) // gender not set
    expect(matchesFilter(aesh, 'aesh')).toBe(true)
  })

  it('matches a colour, using the effective one when given, and never for an AESH', () => {
    expect(matchesFilter(bob, 'orange')).toBe(true)
    expect(matchesFilter(bob, 'red', 'red')).toBe(true)
    expect(matchesFilter(bob, 'orange', 'red')).toBe(false)
    expect(matchesFilter(aesh, 'green')).toBe(false)
  })

  it('finds the students a rule is about', () => {
    const rule = (r: object) => ({ id: 'r', ...r }) as Rule
    expect(ruleStudentIds(rule({ type: 'separate', studentA: ada.id, studentB: bob.id }), schoolClass)).toEqual([
      ada.id,
      bob.id,
    ])
    expect(
      ruleStudentIds(rule({ type: 'influence', student: ada.id, near: carl.id, becomes: 'red' }), schoolClass),
    ).toEqual([ada.id, carl.id])
    expect(ruleStudentIds(rule({ type: 'colors', a: 'red', b: 'orange' }), schoolClass)).toEqual([ada.id, bob.id])
  })
})
