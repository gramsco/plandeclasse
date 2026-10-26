import { isAesh, TRAFFIC_LIGHT_LABELS, type Rule, type SchoolClass, type Student, type TrafficLight } from './types'

/** Quick filters that put some students forward on the plan (the others are dimmed). */
export type StudentFilter = 'delegate' | 'aesh' | 'girl' | 'boy' | TrafficLight

export const STUDENT_FILTERS: StudentFilter[] = ['delegate', 'aesh', 'girl', 'boy', 'red', 'orange', 'green']

export const STUDENT_FILTER_LABELS: Record<StudentFilter, string> = {
  delegate: '👑 Délégués',
  aesh: 'AESH',
  girl: 'Filles',
  boy: 'Garçons',
  ...TRAFFIC_LIGHT_LABELS,
}

/** `light` is the effective one (after the influence rules) when known. */
export function matchesFilter(student: Student, filter: StudentFilter, light: TrafficLight = student.light) {
  if (filter === 'delegate') return student.delegate
  if (filter === 'aesh') return isAesh(student)
  if (filter === 'girl' || filter === 'boy') return student.gender === filter
  return !isAesh(student) && light === filter
}

/** The students a rule is about: the ones it names, or every student of the colours it mentions. */
export function ruleStudentIds(rule: Rule, schoolClass: SchoolClass): string[] {
  if (rule.type === 'separate') return [rule.studentA, rule.studentB]
  if (rule.type === 'influence') return [rule.student, rule.near]
  return schoolClass.students.filter((s) => !isAesh(s) && (s.light === rule.a || s.light === rule.b)).map((s) => s.id)
}
