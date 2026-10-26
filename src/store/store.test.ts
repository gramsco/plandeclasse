import { describe, expect, it } from 'vitest'
import { buildFile, readFile } from '../io/file'
import { roomSeats } from '../model/geometry'
import { LEGACY_V2, legacyFile } from '../model/legacyFixtures'
import { parseStudentList } from '../model/types'
import { memoryStorage } from '../storage/memory'
import { createAppStore } from './store'

const flush = () => new Promise((resolve) => setTimeout(resolve, 10))

const newStore = async (storage = memoryStorage()) => {
  const store = createAppStore(storage, 0)
  await store.getState().init()
  return { store, storage, get: store.getState }
}

describe('parseStudentList', () => {
  it('handles "First Last" and "Last, First"', () => {
    const students = parseStudentList('Ada Lovelace\n\nTuring, Alan\nPlaton')
    expect(students.map((s) => [s.firstName, s.lastName])).toEqual([
      ['Ada', 'Lovelace'],
      ['Alan', 'Turing'],
      ['Platon', ''],
    ])
  })
})

describe('students and classes', () => {
  it('deletes photos with the student and persists changes', async () => {
    const { storage, get } = await newStore()
    get().addClass('6e A')
    get().addStudent('Ada', 'L')
    const id = get().classes[0].students[0].id
    await get().setPhoto(id, new Blob(['x']))
    const photoId = get().classes[0].students[0].photoId!
    expect(await storage.getPhoto(photoId)).toBeDefined()

    get().deleteStudent(id)
    await flush()
    expect(await storage.getPhoto(photoId)).toBeUndefined()
    expect((await storage.loadClasses())[0].students).toHaveLength(0)
  })

  it('duplicates a class together with its photos', async () => {
    const { storage, get } = await newStore()
    get().addClass('A')
    get().addStudent('Ada', '')
    await get().setPhoto(get().classes[0].students[0].id, new Blob(['x']))
    await get().duplicateClass(get().classes[0].id)
    const [original, copy] = get().classes
    expect(copy.students[0].photoId).not.toBe(original.students[0].photoId)
    expect(await storage.getPhoto(copy.students[0].photoId!)).toBeDefined()
  })

  it('removes AESH links and plan rules when a student is deleted', async () => {
    const { get } = await newStore()
    const classId = get().addClass('A', 2)
    const roomId = get().addRoom('empty')
    const planId = get().createPlan(classId, roomId)
    get().addAesh('Sam', '')
    const [student1, student2, aesh] = get().classes[0].students
    get().setSupports(aesh.id, [student1.id])
    get().addRule(planId, { type: 'separate', studentA: student1.id, studentB: student2.id })
    get().deleteStudent(student1.id)
    expect(get().plans[0].rules).toHaveLength(0)
    expect(get().classes[0].students.find((s) => s.role === 'aesh')!.supports).toEqual([])
  })
})

describe('plans and rooms', () => {
  it('assigns seats, then purges when a student or a table disappears', async () => {
    const { storage, get } = await newStore()
    const classId = get().addClass('A', 4)
    const roomId = get().addRoom('doubles-3x4')
    const planId = get().createPlan(classId, roomId)
    get().fillPlan(planId)
    const plan = () => get().plans[0]
    expect(Object.keys(plan().assignments)).toHaveLength(4)

    get().deleteStudent(get().classes[0].students[0].id)
    expect(Object.keys(plan().assignments)).toHaveLength(3)

    const [first] = roomSeats(get().rooms[0])
    get().deleteFurniture(roomId, [first.furnitureId])
    expect(Object.keys(plan().assignments).every((seatId) => seatId !== first.seatId)).toBe(true)

    await flush()
    expect((await storage.loadPlans())[0].assignments).toEqual(plan().assignments)
  })

  it('deleting a room or a class deletes its plans', async () => {
    const { get } = await newStore()
    const classId = get().addClass('A', 2)
    const roomId = get().addRoom('empty')
    get().createPlan(classId, roomId)
    get().deleteRoom(roomId)
    expect(get().plans).toHaveLength(0)
    expect(get().currentPlanId).toBeUndefined()
  })

  it('addFurniture picks a free spot', async () => {
    const { get } = await newStore()
    const roomId = get().addRoom('empty')
    const a = get().addFurniture(roomId, 'double')
    const b = get().addFurniture(roomId, 'double')
    const [fa, fb] = [a, b].map((id) => get().rooms[0].furniture.find((f) => f.id === id)!)
    expect(fa.x === fb.x && fa.y === fb.y).toBe(false)
  })

  it('duplicating a plan creates a linked hypothesis with copied rules', async () => {
    const { get } = await newStore()
    const classId = get().addClass('A', 3)
    const roomId = get().addRoom('doubles-3x4')
    const planId = get().createPlan(classId, roomId)
    get().fillPlan(planId)
    const [student1, student2] = get().classes[0].students
    get().addRule(planId, { type: 'separate', studentA: student1.id, studentB: student2.id })
    get().setStatus(planId, 'testing')
    const copyId = get().duplicatePlan(planId)!
    const [original, copy] = get().plans
    expect(copy.id).toBe(copyId)
    expect(copy).toMatchObject({ status: 'draft', parentId: planId, notes: '' })
    expect(copy.assignments).toEqual(original.assignments)
    expect(copy.rules[0].id).not.toBe(original.rules[0].id)
    expect(original.testingSince).toBeDefined()
  })
})

describe('import / export', () => {
  it('round-trips everything, photos included, with merge and replace', async () => {
    const source = await newStore()
    const classId = source.get().addDemoClass()
    const roomId = source.get().addRoom('islands-3x2')
    source.get().createPlan(classId, roomId)
    source.get().fillPlan(source.get().plans[0].id)
    await source.get().setPhoto(source.get().classes[0].students[0].id, new Blob(['jpegdata'], { type: 'image/jpeg' }))

    const file = readFile(JSON.stringify(await buildFile(source.get(), source.storage)))
    expect(Object.keys(file.photos)).toHaveLength(1)

    const target = await newStore()
    await target.get().importData(file, 'merge')
    await target.get().importData(file, 'merge') // idempotent
    expect(target.get().classes).toHaveLength(1)
    expect(target.get().plans[0].assignments).toEqual(source.get().plans[0].assignments)
    const photoId = target.get().classes[0].students[0].photoId!
    expect(target.get().photoUrls[photoId]).toBeDefined()

    await target.get().importData(file, 'replace')
    expect(target.get().rooms).toHaveLength(1)
  })

  it('rejects invalid files', () => {
    expect(() => readFile('not json')).toThrow()
    expect(() => readFile('{"format":"other"}')).toThrow()
    expect(() => readFile('{"format":"classe","version":99}')).toThrow(/plus récente/)
    expect(() => readFile('{"format":"classe","version":0}')).toThrow()
  })

  it('migrates a version 1 file on import', () => {
    const file = readFile(JSON.stringify(legacyFile(1)))
    expect(file.version).toBe(3)
    expect(file.classes[0].students[0]).toMatchObject({ firstName: 'Ada', light: 'green', role: 'student' })
    expect(file.rooms[0]).toMatchObject({ name: 'S', width: 1200 })
    expect(file.plans[0]).toMatchObject({ status: 'draft', classId: 'c1', roomId: 's1' })
  })

  it('migrates a version 2 file (French field names) on import', () => {
    const file = readFile(JSON.stringify(legacyFile(2)))
    expect(file.exportedAt).toBe('2026-01-01')
    expect(file.classes[0].students[0]).toMatchObject({ light: 'red', gender: 'girl' })
    expect(file.plans[0].rules).toHaveLength(3)
  })

  it('writes the current version and the application version', async () => {
    const file = await buildFile({ classes: [], rooms: [], plans: [] }, memoryStorage())
    expect(file.version).toBe(3)
    expect(file.application).toBeDefined()
  })
})

describe('data versions and migrations', () => {
  /** Storage holding data as written by an old release (rooms were copied from the old `salles` store). */
  const legacyStorage = async (version?: number) => {
    const storage = memoryStorage()
    await storage.saveClass(LEGACY_V2.classes[0] as never)
    await storage.saveRoom(LEGACY_V2.salles[0] as never) // lang-ignore: legacy key
    await storage.savePlan(LEGACY_V2.plans[0] as never)
    if (version !== undefined) await storage.setMeta('versionDonnees', version)
    return storage
  }

  it('migrates data from before the English rename, keeping a backup', async () => {
    const storage = await legacyStorage(2)
    const { get } = await newStore(storage)
    expect(get().classes[0]).toMatchObject({ name: '6e A', students: [{ firstName: 'Ada', light: 'red' }, {}] })
    expect(get().rooms[0]).toMatchObject({ name: 'Salle 12', furniture: [{ type: 'island' }] })
    expect(get().plans[0]).toMatchObject({ classId: 'c1', roomId: 's1', status: 'testing' })
    expect(await storage.getMeta('dataVersion')).toBe(3)
    expect(await storage.getMeta('versionDonnees')).toBe(3) // lets older releases refuse the new data
    expect((await storage.getMeta<{ version: number }>('preMigrationBackup'))?.version).toBe(2)
    expect(await storage.loadClasses()).toEqual(get().classes) // migrated in the database too
  })

  it('treats data without a version marker as version 1', async () => {
    const storage = await legacyStorage()
    const { get } = await newStore(storage)
    expect(get().classes[0].students[0]).toMatchObject({ firstName: 'Ada', role: 'student' })
    expect((await storage.getMeta<{ version: number }>('preMigrationBackup'))?.version).toBe(1)
  })

  it('does nothing on an empty database', async () => {
    const { storage } = await newStore()
    expect(await storage.getMeta('dataVersion')).toBe(3)
    expect(await storage.getMeta('preMigrationBackup')).toBeUndefined()
  })

  it('refuses, without writing anything, data from a newer release', async () => {
    const storage = await legacyStorage(99)
    const { get } = await newStore(storage)
    expect(get().versionError).toMatch(/plus récente/)
    expect(get().classes).toHaveLength(0)
    expect(await storage.getMeta('versionDonnees')).toBe(99)
    expect((await storage.loadClasses())[0]).toEqual(LEGACY_V2.classes[0])
  })
})
