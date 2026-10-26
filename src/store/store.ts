import { create } from 'zustand'
import { base64ToBlob, type ExportFile } from '../io/file'
import { demoClass, shuffleLights } from '../model/demo'
import { moveItem, sortByIds } from '../model/order'
import { footprint, snap } from '../model/geometry'
import { DATA_VERSION, migrate, toRawData } from '../model/migrations'
import {
  assign,
  fillRandomly,
  purgeAssignments,
  purgeRules,
  transposeAssignments,
  type FillStrategy,
} from '../model/plan'
import { createFurniture, duplicateFurniture, duplicateRoom, findRoomTemplate } from '../model/rooms'
import {
  newAesh,
  newId,
  newSchoolClass,
  newStudent,
  normalizeClass,
  normalizePlan,
  normalizeRoom,
  type FurnitureType,
  type Gender,
  type Plan,
  type PlanStatus,
  type Rotation,
  type Room,
  type Rule,
  type SchoolClass,
  type Student,
  type TrafficLight,
} from '../model/types'
import type { Storage } from '../storage/storage'

type WithoutId<T> = T extends { id: string } ? Omit<T, 'id'> : never

export type View = 'plans' | 'classes' | 'rooms' | 'help'

/** Meta keys. The `versionDonnees` key is the one older releases read: keep writing it so that they refuse newer data. */
const META_DATA_VERSION = 'dataVersion'
const META_LEGACY_DATA_VERSION = 'versionDonnees'
const META_CLASS_ORDER = 'classOrder'
const META_BACKUP = 'preMigrationBackup'

type State = {
  ready: boolean
  /** Set when the stored data was written by a newer release: we must not touch it. */
  versionError?: string
  view: View
  classes: SchoolClass[]
  rooms: Room[]
  plans: Plan[]
  currentClassId?: string
  currentRoomId?: string
  currentPlanId?: string
  photoUrls: Record<string, string>
}

type Actions = {
  init(): Promise<void>
  setView(view: View): void

  addClass(name: string, studentCount?: number): string
  addDemoClass(): string
  renameClass(id: string, name: string): void
  duplicateClass(id: string): Promise<void>
  deleteClass(id: string): void
  selectClass(id: string): void
  /** Drops the class `fromId` onto `toId`; the order is kept across sessions. */
  reorderClasses(fromId: string, toId: string): void
  addStudents(students: Student[]): void
  addStudent(firstName: string, lastName: string): void
  addAesh(firstName: string, lastName: string): void
  setLight(id: string, light: TrafficLight): void
  setGender(id: string, gender: Gender | undefined): void
  setDelegate(id: string, delegate: boolean): void
  setDeputy(id: string, deputy: boolean): void
  shuffleLights(): void
  toggleAnnotation(id: string, label: string): void
  setSupports(aeshId: string, studentIds: string[]): void
  updateStudent(id: string, patch: Partial<Pick<Student, 'firstName' | 'lastName' | 'note'>>): void
  deleteStudent(id: string): void
  setPhoto(studentId: string, blob: Blob): Promise<void>
  removePhoto(studentId: string): void

  addRoom(templateKey: string): string
  renameRoom(id: string, name: string): void
  duplicateRoom(id: string): void
  deleteRoom(id: string): void
  selectRoom(id: string): void
  resizeRoom(id: string, width: number, height: number): void
  addFurniture(roomId: string, type: FurnitureType): string
  moveFurniture(roomId: string, positions: { id: string; x: number; y: number }[]): void
  rotateFurniture(roomId: string, ids: string[]): void
  duplicateFurnitureItems(roomId: string, ids: string[]): string[]
  deleteFurniture(roomId: string, ids: string[]): void

  createPlan(classId: string, roomId: string, status?: PlanStatus): string
  renamePlan(id: string, name: string): void
  deletePlan(id: string): void
  selectPlan(id: string): void
  assignSeat(planId: string, studentId: string, seatId: string | null): void
  clearPlan(planId: string): void
  fillPlan(planId: string, strategy?: FillStrategy): void
  applyPlanToRoom(planId: string, roomId: string): string | undefined
  addRule(planId: string, rule: WithoutId<Rule>): void
  deleteRule(planId: string, ruleId: string): void
  duplicatePlan(planId: string): string | undefined
  setStatus(planId: string, status: PlanStatus): void
  setNotes(planId: string, notes: string): void

  importData(file: ExportFile, mode: 'merge' | 'replace'): Promise<void>
}

export type AppStore = State & Actions

export function createAppStore(storage: Storage, debounceMs = 300) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  return create<AppStore>((set, get) => {
    /** Saves a record shortly after its last change (debounced per record). */
    const scheduleSave = (kind: 'classes' | 'rooms' | 'plans', id: string) => {
      const key = `${kind}:${id}`
      clearTimeout(timers.get(key))
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key)
          if (kind === 'classes') {
            const record = get().classes.find((c) => c.id === id)
            if (record) void storage.saveClass(record)
          } else if (kind === 'rooms') {
            const record = get().rooms.find((r) => r.id === id)
            if (record) void storage.saveRoom(record)
          } else {
            const record = get().plans.find((p) => p.id === id)
            if (record) void storage.savePlan(record)
          }
        }, debounceMs),
      )
    }
    const cancelSave = (kind: string, id: string) => clearTimeout(timers.get(`${kind}:${id}`))

    /** Drops from the plans what became invalid (deleted student or furniture). */
    const purgePlans = () => {
      const { plans, classes, rooms } = get()
      let changed = false
      const next = plans.map((plan) => {
        const schoolClass = classes.find((c) => c.id === plan.classId)
        const assignments = purgeAssignments(
          plan,
          schoolClass,
          rooms.find((r) => r.id === plan.roomId),
        )
        const rules = purgeRules(plan.rules, schoolClass)
        if (
          Object.keys(assignments).length === Object.keys(plan.assignments).length &&
          rules.length === plan.rules.length
        )
          return plan
        changed = true
        scheduleSave('plans', plan.id)
        return { ...plan, assignments, rules }
      })
      if (changed) set({ plans: next })
    }

    const updateClass = (id: string, fn: (c: SchoolClass) => SchoolClass) => {
      set((s) => ({ classes: s.classes.map((c) => (c.id === id ? fn(c) : c)) }))
      scheduleSave('classes', id)
      purgePlans()
    }
    const updateRoom = (id: string, fn: (r: Room) => Room) => {
      set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? fn(r) : r)) }))
      scheduleSave('rooms', id)
      purgePlans()
    }
    const updatePlan = (id: string, fn: (p: Plan) => Plan) => {
      set((s) => ({ plans: s.plans.map((p) => (p.id === id ? fn(p) : p)) }))
      scheduleSave('plans', id)
    }
    const updateCurrentClass = (fn: (c: SchoolClass) => SchoolClass) => {
      const { currentClassId } = get()
      if (currentClassId) updateClass(currentClassId, fn)
    }

    const loadPhotoUrl = async (photoId: string) => {
      if (get().photoUrls[photoId]) return
      const blob = await storage.getPhoto(photoId)
      if (blob) set((s) => ({ photoUrls: { ...s.photoUrls, [photoId]: URL.createObjectURL(blob) } }))
    }

    const deletePhotos = (ids: (string | undefined)[]) => {
      for (const id of ids) {
        if (!id) continue
        void storage.deletePhoto(id)
        const url = get().photoUrls[id]
        if (url) URL.revokeObjectURL(url)
        set((s) => {
          const { [id]: _removed, ...rest } = s.photoUrls
          return { photoUrls: rest }
        })
      }
    }

    const removePlans = (predicate: (p: Plan) => boolean) => {
      for (const plan of get().plans.filter(predicate)) {
        cancelSave('plans', plan.id)
        void storage.deletePlan(plan.id)
      }
      set((s) => {
        const plans = s.plans.filter((p) => !predicate(p))
        return { plans, currentPlanId: plans.some((p) => p.id === s.currentPlanId) ? s.currentPlanId : plans[0]?.id }
      })
    }

    const studentById = (id: string) =>
      get()
        .classes.flatMap((c) => c.students)
        .find((s) => s.id === id)
    const roomById = (id: string) => get().rooms.find((r) => r.id === id)

    const newerVersionMessage = (found: number | string) =>
      `Vos données ont été enregistrées par une version plus récente de l'application (format ${found}, celle-ci comprend jusqu'au format ${DATA_VERSION}). Rechargez la page pour obtenir la dernière version. Vos données n'ont pas été modifiées.`

    return {
      ready: false,
      view: 'plans',
      classes: [],
      rooms: [],
      plans: [],
      photoUrls: {},

      async init() {
        try {
          const stored = {
            classes: await storage.loadClasses(),
            rooms: await storage.loadRooms(),
            plans: await storage.loadPlans(),
          }
          const isEmpty = !stored.classes.length && !stored.rooms.length && !stored.plans.length
          // No version marker: an empty database is up to date; a filled one predates versioning (v1).
          const storedVersion =
            (await storage.getMeta<number>(META_DATA_VERSION)) ??
            (await storage.getMeta<number>(META_LEGACY_DATA_VERSION)) ??
            (isEmpty ? DATA_VERSION : 1)
          if (storedVersion > DATA_VERSION) {
            set({ ready: true, versionError: newerVersionMessage(storedVersion) })
            return
          }
          let data: { classes: unknown[]; rooms: unknown[]; plans: unknown[] } = stored
          if (storedVersion < DATA_VERSION) {
            // Safety net: keep a copy of the original data before any migration.
            await storage.setMeta(META_BACKUP, {
              version: storedVersion,
              date: new Date().toISOString(),
              data: stored,
            })
            data = migrate(toRawData(storedVersion, stored), storedVersion)
            await Promise.all([
              ...data.classes.map((c) => storage.saveClass(normalizeClass(c))),
              ...data.rooms.map((r) => storage.saveRoom(normalizeRoom(r))),
              ...data.plans.map((p) => storage.savePlan(normalizePlan(p))),
            ])
          }
          await storage.setMeta(META_DATA_VERSION, DATA_VERSION)
          await storage.setMeta(META_LEGACY_DATA_VERSION, DATA_VERSION)
          const classOrder = (await storage.getMeta<string[]>(META_CLASS_ORDER)) ?? []
          const classes = sortByIds(data.classes.map(normalizeClass), classOrder)
          const rooms = data.rooms.map(normalizeRoom)
          const plans = data.plans.map(normalizePlan)
          set({
            classes,
            rooms,
            plans,
            currentClassId: classes[0]?.id,
            currentRoomId: rooms[0]?.id,
            currentPlanId: plans[0]?.id,
            ready: true,
          })
          const used = new Set(classes.flatMap((c) => c.students.map((s) => s.photoId)))
          for (const id of await storage.listPhotoIds()) if (!used.has(id)) void storage.deletePhoto(id)
          for (const id of used) if (id) void loadPhotoUrl(id)
        } catch (error) {
          // Opening a database whose version is higher than ours fails with a VersionError.
          if ((error as Error)?.name === 'VersionError')
            set({ ready: true, versionError: newerVersionMessage('inconnu') })
          else throw error
        }
      },

      setView: (view) => set({ view }),

      // ---- Classes ----
      addClass(name, studentCount = 0) {
        const schoolClass = newSchoolClass(name, studentCount)
        set((s) => ({ classes: [...s.classes, schoolClass], currentClassId: schoolClass.id }))
        scheduleSave('classes', schoolClass.id)
        return schoolClass.id
      },
      addDemoClass() {
        const schoolClass = demoClass()
        set((s) => ({ classes: [...s.classes, schoolClass], currentClassId: schoolClass.id }))
        scheduleSave('classes', schoolClass.id)
        return schoolClass.id
      },
      renameClass: (id, name) => updateClass(id, (c) => ({ ...c, name })),
      selectClass: (id) => set({ currentClassId: id }),
      reorderClasses(fromId, toId) {
        const classes = moveItem(get().classes, fromId, toId)
        if (classes === get().classes) return
        set({ classes })
        void storage.setMeta(
          META_CLASS_ORDER,
          classes.map((c) => c.id),
        )
      },

      async duplicateClass(id) {
        const source = get().classes.find((c) => c.id === id)
        if (!source) return
        const idMap = new Map<string, string>()
        const students: Student[] = []
        for (const student of source.students) {
          let photoId: string | undefined
          if (student.photoId) {
            const blob = await storage.getPhoto(student.photoId)
            if (blob) {
              photoId = newId()
              await storage.putPhoto(photoId, blob)
              void loadPhotoUrl(photoId)
            }
          }
          const newStudentId = newId()
          idMap.set(student.id, newStudentId)
          students.push({ ...student, id: newStudentId, photoId })
        }
        const copy: SchoolClass = {
          ...structuredClone(source),
          id: newId(),
          name: `${source.name} (copie)`,
          students: students.map((s) => ({ ...s, supports: s.supports.map((sid) => idMap.get(sid) ?? sid) })),
        }
        set((s) => ({ classes: [...s.classes, copy], currentClassId: copy.id }))
        scheduleSave('classes', copy.id)
      },

      deleteClass(id) {
        const schoolClass = get().classes.find((c) => c.id === id)
        if (!schoolClass) return
        cancelSave('classes', id)
        deletePhotos(schoolClass.students.map((s) => s.photoId))
        void storage.deleteClass(id)
        removePlans((p) => p.classId === id)
        set((s) => {
          const classes = s.classes.filter((c) => c.id !== id)
          return { classes, currentClassId: s.currentClassId === id ? classes[0]?.id : s.currentClassId }
        })
      },

      addStudents: (students) => updateCurrentClass((c) => ({ ...c, students: [...c.students, ...students] })),
      addStudent: (firstName, lastName) => get().addStudents([newStudent(firstName, lastName)]),
      addAesh: (firstName, lastName) => get().addStudents([newAesh(firstName, lastName)]),
      setLight: (id, light) =>
        updateCurrentClass((c) => ({ ...c, students: c.students.map((s) => (s.id === id ? { ...s, light } : s)) })),
      toggleAnnotation: (id, label) => {
        const trimmed = label.trim()
        if (!trimmed) return
        updateCurrentClass((c) => ({
          ...c,
          students: c.students.map((s) =>
            s.id !== id
              ? s
              : {
                  ...s,
                  annotations: s.annotations.includes(trimmed)
                    ? s.annotations.filter((a) => a !== trimmed)
                    : [...s.annotations, trimmed],
                },
          ),
        }))
      },
      shuffleLights: () => updateCurrentClass((c) => ({ ...c, students: shuffleLights(c.students) })),
      setGender: (id, gender) =>
        updateCurrentClass((c) => ({ ...c, students: c.students.map((s) => (s.id === id ? { ...s, gender } : s)) })),
      // Delegate and deputy exclude each other: one student cannot hold both crowns.
      setDelegate: (id, delegate) =>
        updateCurrentClass((c) => ({
          ...c,
          // A class has a single delegate: naming a new one relieves the previous one.
          students: c.students.map((s) =>
            s.id === id
              ? { ...s, delegate, deputy: delegate ? false : s.deputy }
              : { ...s, delegate: delegate ? false : s.delegate },
          ),
        })),
      setDeputy: (id, deputy) =>
        updateCurrentClass((c) => ({
          ...c,
          students: c.students.map((s) =>
            s.id === id
              ? { ...s, deputy, delegate: deputy ? false : s.delegate }
              : { ...s, deputy: deputy ? false : s.deputy },
          ),
        })),
      setSupports: (aeshId, studentIds) =>
        updateCurrentClass((c) => ({
          ...c,
          students: c.students.map((s) => (s.id === aeshId ? { ...s, supports: studentIds } : s)),
        })),
      updateStudent: (id, patch) =>
        updateCurrentClass((c) => ({ ...c, students: c.students.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),

      deleteStudent(id) {
        deletePhotos([studentById(id)?.photoId])
        updateCurrentClass((c) => ({
          ...c,
          students: c.students
            .filter((s) => s.id !== id)
            .map((s) => (s.supports.includes(id) ? { ...s, supports: s.supports.filter((sid) => sid !== id) } : s)),
        }))
      },

      async setPhoto(studentId, blob) {
        const previous = studentById(studentId)?.photoId
        const photoId = newId()
        await storage.putPhoto(photoId, blob)
        set((s) => ({ photoUrls: { ...s.photoUrls, [photoId]: URL.createObjectURL(blob) } }))
        deletePhotos([previous])
        updateCurrentClass((c) => ({
          ...c,
          students: c.students.map((s) => (s.id === studentId ? { ...s, photoId } : s)),
        }))
      },

      removePhoto(studentId) {
        deletePhotos([studentById(studentId)?.photoId])
        updateCurrentClass((c) => ({
          ...c,
          students: c.students.map((s) => (s.id === studentId ? { ...s, photoId: undefined } : s)),
        }))
      },

      // ---- Rooms ----
      addRoom(templateKey) {
        const room = (findRoomTemplate(templateKey) ?? findRoomTemplate('empty')!).create()
        set((s) => ({ rooms: [...s.rooms, room], currentRoomId: room.id }))
        scheduleSave('rooms', room.id)
        return room.id
      },
      renameRoom: (id, name) => updateRoom(id, (r) => ({ ...r, name })),
      selectRoom: (id) => set({ currentRoomId: id }),
      duplicateRoom(id) {
        const source = roomById(id)
        if (!source) return
        const copy = duplicateRoom(source)
        set((s) => ({ rooms: [...s.rooms, copy], currentRoomId: copy.id }))
        scheduleSave('rooms', copy.id)
      },
      deleteRoom(id) {
        cancelSave('rooms', id)
        void storage.deleteRoom(id)
        removePlans((p) => p.roomId === id)
        set((s) => {
          const rooms = s.rooms.filter((r) => r.id !== id)
          return { rooms, currentRoomId: s.currentRoomId === id ? rooms[0]?.id : s.currentRoomId }
        })
      },
      resizeRoom: (id, width, height) =>
        updateRoom(id, (r) => ({ ...r, width: Math.max(400, width), height: Math.max(300, height) })),

      addFurniture(roomId, type) {
        const furniture = createFurniture(type, 0, 0)
        const room = roomById(roomId)
        if (room) {
          // First free spot on the grid, scanning the room.
          const isFree = (x: number, y: number) => {
            const rect = footprint({ ...furniture, x, y })
            return room.furniture.every((other) => {
              const o = footprint(other)
              return rect.x >= o.x + o.w || o.x >= rect.x + rect.w || rect.y >= o.y + o.h || o.y >= rect.y + rect.h
            })
          }
          const step = 20
          scan: for (let y = 20; y + furniture.height <= room.height; y += step)
            for (let x = 20; x + furniture.width <= room.width; x += step)
              if (isFree(x, y)) {
                furniture.x = x
                furniture.y = y
                break scan
              }
        }
        updateRoom(roomId, (r) => ({ ...r, furniture: [...r.furniture, furniture] }))
        return furniture.id
      },
      moveFurniture: (roomId, positions) => {
        const byId = new Map(positions.map((p) => [p.id, p]))
        updateRoom(roomId, (r) => ({
          ...r,
          furniture: r.furniture.map((f) => {
            const position = byId.get(f.id)
            return position ? { ...f, x: position.x, y: position.y } : f
          }),
        }))
      },
      rotateFurniture: (roomId, ids) =>
        updateRoom(roomId, (r) => ({
          ...r,
          furniture: r.furniture.map((f) => {
            if (!ids.includes(f.id)) return f
            const rotated = { ...f, rotation: ((f.rotation + 90) % 360) as Rotation }
            // Keep the footprint inside the room and aligned on the grid.
            const { dx, dy } = snap(footprint(rotated), [], r)
            return { ...rotated, x: rotated.x + dx, y: rotated.y + dy }
          }),
        })),
      duplicateFurnitureItems(roomId, ids) {
        const copies = (roomById(roomId)?.furniture ?? [])
          .filter((f) => ids.includes(f.id))
          .map((f) => duplicateFurniture(f))
        updateRoom(roomId, (r) => ({ ...r, furniture: [...r.furniture, ...copies] }))
        return copies.map((f) => f.id)
      },
      deleteFurniture: (roomId, ids) =>
        updateRoom(roomId, (r) => ({ ...r, furniture: r.furniture.filter((f) => !ids.includes(f.id)) })),

      // ---- Plans ----
      createPlan(classId, roomId, status = 'draft') {
        const schoolClass = get().classes.find((c) => c.id === classId)
        const room = roomById(roomId)
        const plan: Plan = {
          id: newId(),
          name: `${schoolClass?.name ?? 'Classe'} — ${room?.name ?? 'Salle'}`,
          classId,
          roomId,
          assignments: {},
          rules: [],
          status,
          notes: '',
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ plans: [...s.plans, plan], currentPlanId: plan.id, view: 'plans' }))
        scheduleSave('plans', plan.id)
        return plan.id
      },
      renamePlan: (id, name) => updatePlan(id, (p) => ({ ...p, name })),
      selectPlan: (id) => set({ currentPlanId: id }),
      deletePlan: (id) => removePlans((p) => p.id === id),
      assignSeat: (planId, studentId, seatId) =>
        updatePlan(planId, (p) => ({ ...p, assignments: assign(p.assignments, studentId, seatId) })),
      clearPlan: (planId) => updatePlan(planId, (p) => ({ ...p, assignments: {} })),
      fillPlan(planId, strategy = 'random') {
        const plan = get().plans.find((p) => p.id === planId)
        const schoolClass = plan && get().classes.find((c) => c.id === plan.classId)
        const room = plan && roomById(plan.roomId)
        if (plan && schoolClass && room)
          updatePlan(planId, (p) => ({ ...p, assignments: fillRandomly(p, schoolClass, room, Math.random, strategy) }))
      },
      applyPlanToRoom(planId, roomId) {
        const source = get().plans.find((p) => p.id === planId)
        const from = source && roomById(source.roomId)
        const to = roomById(roomId)
        if (!source || !from || !to || from.id === to.id) return
        const copy: Plan = {
          ...structuredClone(source),
          id: newId(),
          name: `${source.name.replace(/ — .*$/, '')} — ${to.name}`,
          roomId: to.id,
          assignments: transposeAssignments(source.assignments, from, to),
          rules: source.rules.map((r) => ({ ...r, id: newId() })),
          status: 'draft',
          notes: '',
          parentId: source.id,
          createdAt: new Date().toISOString(),
          testingSince: undefined,
        }
        set((s) => ({ plans: [...s.plans, copy], currentPlanId: copy.id }))
        scheduleSave('plans', copy.id)
        return copy.id
      },
      addRule: (planId, rule) =>
        updatePlan(planId, (p) => ({ ...p, rules: [...p.rules, { ...rule, id: newId() } as Rule] })),
      deleteRule: (planId, ruleId) =>
        updatePlan(planId, (p) => ({ ...p, rules: p.rules.filter((r) => r.id !== ruleId) })),

      duplicatePlan(planId) {
        const source = get().plans.find((p) => p.id === planId)
        if (!source) return
        const siblings = get().plans.filter((p) => p.classId === source.classId && p.roomId === source.roomId).length
        const copy: Plan = {
          ...structuredClone(source),
          id: newId(),
          name: `${source.name.replace(/ \(hyp\. \d+\)$/, '')} (hyp. ${siblings + 1})`,
          rules: source.rules.map((r) => ({ ...r, id: newId() })),
          status: 'draft',
          notes: '',
          parentId: source.id,
          createdAt: new Date().toISOString(),
          testingSince: undefined,
        }
        set((s) => ({ plans: [...s.plans, copy], currentPlanId: copy.id }))
        scheduleSave('plans', copy.id)
        return copy.id
      },
      setStatus: (planId, status) =>
        updatePlan(planId, (p) => ({
          ...p,
          status,
          testingSince: status === 'testing' && !p.testingSince ? new Date().toISOString() : p.testingSince,
        })),
      setNotes: (planId, notes) => updatePlan(planId, (p) => ({ ...p, notes })),

      async importData(file, mode) {
        if (mode === 'replace') {
          const { classes, rooms, plans } = get()
          await Promise.all([
            ...classes.map((c) => storage.deleteClass(c.id)),
            ...rooms.map((r) => storage.deleteRoom(r.id)),
            ...plans.map((p) => storage.deletePlan(p.id)),
            ...(await storage.listPhotoIds()).map((id) => storage.deletePhoto(id)),
          ])
          for (const url of Object.values(get().photoUrls)) URL.revokeObjectURL(url)
          set({
            classes: [],
            rooms: [],
            plans: [],
            photoUrls: {},
            currentClassId: undefined,
            currentRoomId: undefined,
            currentPlanId: undefined,
          })
        }
        const urls: Record<string, string> = {}
        for (const [id, photo] of Object.entries(file.photos)) {
          const blob = base64ToBlob(photo.base64, photo.type)
          await storage.putPhoto(id, blob)
          const previousUrl = get().photoUrls[id]
          if (previousUrl) URL.revokeObjectURL(previousUrl)
          urls[id] = URL.createObjectURL(blob)
        }
        await Promise.all([
          ...file.classes.map((c) => storage.saveClass(c)),
          ...file.rooms.map((r) => storage.saveRoom(r)),
          ...file.plans.map((p) => storage.savePlan(p)),
        ])
        const merge = <T extends { id: string }>(existing: T[], incoming: T[]) => [
          ...existing.filter((x) => !incoming.some((n) => n.id === x.id)),
          ...incoming,
        ]
        set((s) => {
          const classes = merge(s.classes, file.classes)
          const rooms = merge(s.rooms, file.rooms)
          const plans = merge(s.plans, file.plans)
          return {
            classes,
            rooms,
            plans,
            photoUrls: { ...s.photoUrls, ...urls },
            currentClassId: s.currentClassId ?? classes[0]?.id,
            currentRoomId: s.currentRoomId ?? rooms[0]?.id,
            currentPlanId: s.currentPlanId ?? plans[0]?.id,
          }
        })
        purgePlans()
      },
    }
  })
}
