import { newSchoolClass, newStudent, type SchoolClass, type Student, type TrafficLight } from './types'

const STUDENTS: [string, string][] = [
  ['Emma', 'Martin'],
  ['Lucas', 'Bernard'],
  ['Léa', 'Dubois'],
  ['Hugo', 'Thomas'],
  ['Chloé', 'Robert'],
  ['Louis', 'Richard'],
  ['Inès', 'Petit'],
  ['Gabriel', 'Durand'],
  ['Jade', 'Leroy'],
  ['Arthur', 'Moreau'],
  ['Manon', 'Simon'],
  ['Jules', 'Laurent'],
  ['Camille', 'Lefebvre'],
  ['Raphaël', 'Michel'],
  ['Sarah', 'Garcia'],
  ['Nathan', 'David'],
  ['Zoé', 'Bertrand'],
  ['Adam', 'Roux'],
  ['Lina', 'Vincent'],
  ['Tom', 'Fournier'],
  ['Alice', 'Morel'],
  ['Noah', 'Girard'],
  ['Louise', 'André'],
  ['Ethan', 'Lefèvre'],
  ['Juliette', 'Mercier'],
  ['Maël', 'Dupont'],
  ['Anaïs', 'Lambert'],
  ['Yanis', 'Bonnet'],
]

const GIRLS = new Set([
  'Alice',
  'Anaïs',
  'Camille',
  'Chloé',
  'Emma',
  'Inès',
  'Jade',
  'Juliette',
  'Lina',
  'Louise',
  'Léa',
  'Manon',
  'Sarah',
  'Zoé',
])

/** A realistic spread: 1-2 red, 5-6 orange, the rest green (scaled down for small classes). */
export function randomLights(count: number, rng = Math.random): TrafficLight[] {
  const reds = Math.min(count, 1 + Math.floor(rng() * 2))
  const oranges = Math.min(count - reds, 5 + Math.floor(rng() * 2))
  const lights: TrafficLight[] = [
    ...Array<TrafficLight>(reds).fill('red'),
    ...Array<TrafficLight>(oranges).fill('orange'),
    ...Array<TrafficLight>(count - reds - oranges).fill('green'),
  ]
  for (let i = lights.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[lights[i], lights[j]] = [lights[j], lights[i]]
  }
  return lights
}

/** Applies a random spread of traffic lights to the students (AESH are left alone). */
export function shuffleLights(people: Student[], rng = Math.random): Student[] {
  const students = people.filter((p) => p.role === 'student')
  const lights = randomLights(students.length, rng)
  const byId = new Map(students.map((s, i) => [s.id, lights[i]]))
  return people.map((p) => (byId.has(p.id) ? { ...p, light: byId.get(p.id)! } : p))
}

/** A fictional class of 28 students, to try the application out. */
export function demoClass(): SchoolClass {
  const schoolClass = newSchoolClass('Classe de test (28 élèves)')
  schoolClass.students = shuffleLights(
    STUDENTS.map(([firstName, lastName]) => ({
      ...newStudent(firstName, lastName),
      gender: GIRLS.has(firstName) ? ('girl' as const) : ('boy' as const),
    })),
  )
  // A few annotations to play with: 2-3 PAP, 1-2 DYS, 1 PAI.
  const order = schoolClass.students.map((_, i) => i).sort(() => Math.random() - 0.5)
  const annotate = (label: string, count: number) =>
    order.splice(0, count).forEach((i) => schoolClass.students[i].annotations.push(label))
  annotate('PAP', 2 + Math.floor(Math.random() * 2))
  annotate('DYS', 1 + Math.floor(Math.random() * 2))
  annotate('PAI', 1)
  return schoolClass
}
