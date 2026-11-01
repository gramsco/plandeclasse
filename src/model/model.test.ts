import { describe, expect, it } from 'vitest'
import { randomLights } from './demo'
import { footprint, seatBack, roomSeats, seatCenter, snap } from './geometry'
import { relation } from './analysis'
import { assign, fillRandomly, lookoutSeats, purgeAssignments, purgeRules, transposeAssignments } from './plan'
import { stepInRoom } from './walk'
import { createFurniture, createFurnitureIn, findRoomTemplate, isWallItem, ROOM_TEMPLATES } from './rooms'
import { newSchoolClass, normalizePlan, normalizeStudent, type Plan, type Student } from './types'

describe('seat orientation', () => {
  const back = (type: Parameters<typeof createFurniture>[0], rotation: 0 | 90 | 180 | 270, seatIndex = 0) => {
    const f = createFurniture(type, 0, 0, rotation)
    const { x, y } = seatBack(f, f.seats[seatIndex])
    return [Math.round(x), Math.round(y)]
  }

  it('seats students on the south side of an unrotated table', () => {
    expect(back('single', 0)).toEqual([0, 1])
    expect(back('double', 0, 0)).toEqual([0, 1])
    expect(back('double', 0, 1)).toEqual([0, 1])
  })

  it('seats the top row of an island on its north side and the bottom row on its south side', () => {
    expect(back('island', 0, 0)).toEqual([0, -1]) // top left
    expect(back('island', 0, 1)).toEqual([0, -1]) // top right
    expect(back('island', 0, 2)).toEqual([0, 1]) // bottom left
    expect(back('island', 0, 3)).toEqual([0, 1]) // bottom right
  })

  it('turns with the table', () => {
    expect(back('single', 90)).toEqual([-1, 0])
    expect(back('single', 180)).toEqual([0, -1])
    expect(back('single', 270)).toEqual([1, 0])
    expect(back('island', 90, 0)).toEqual([1, 0])
  })
})

describe('lookoutSeats', () => {
  const room = ROOM_TEMPLATES[0].create()
  const schoolClass = newSchoolClass('A', 3)
  const seats = roomSeats(room)

  it('numbers every seat of a bare room', () => {
    const list = lookoutSeats(room)
    expect(list).toHaveLength(seats.length)
    expect(list[0]).toEqual({ id: seats[0].seatId, label: 'Place 1' })
  })

  it('lists only the occupied seats of a plan, by student name', () => {
    const [first, second] = schoolClass.students
    const plan = {
      assignments: { [seats[4].seatId]: first.id, [seats[1].seatId]: second.id },
    } as unknown as Plan
    const list = lookoutSeats(room, plan, schoolClass)
    expect(list.map((s) => s.id)).toEqual([seats[1].seatId, seats[4].seatId])
    expect(list[0].label).toBe(`${second.firstName} ${second.lastName}`.trim())
  })
})

describe('walking in the room', () => {
  const empty = { ...ROOM_TEMPLATES[0].create(), furniture: [] }
  const table = createFurniture('single', 400, 300) // 100 x 92, footprint x 400-500, y 300-392
  const room = { ...empty, furniture: [table] }

  it('moves freely in the open and stops at the walls', () => {
    expect(stepInRoom(empty, { x: 100, y: 100 }, { x: 140, y: 120 })).toEqual({ x: 140, y: 120 })
    expect(stepInRoom(empty, { x: 100, y: 100 }, { x: -50, y: 120 })).toEqual({ x: 100, y: 120 })
    expect(stepInRoom(empty, { x: 100, y: 100 }, { x: 100, y: empty.height + 50 })).toEqual({ x: 100, y: 100 })
  })

  it('does not go through a table', () => {
    expect(stepInRoom(room, { x: 350, y: 346 }, { x: 420, y: 346 })).toEqual({ x: 350, y: 346 })
  })

  it('slides along a table when walking into it at an angle', () => {
    const next = stepInRoom(room, { x: 350, y: 346 }, { x: 420, y: 250 })
    expect(next.x).toBe(350) // blocked sideways
    expect(next.y).toBe(250) // free upwards
  })

  it('lets someone who starts inside a table walk out of it', () => {
    const start = { x: 450, y: 346 }
    expect(stepInRoom(room, start, { x: 450, y: 600 }).y).toBe(600)
  })

  it('walks through wall items: doors, windows and boards are not obstacles', () => {
    const withDoor = { ...empty, furniture: [createFurniture('door', 200, 100)] }
    expect(stepInRoom(withDoor, { x: 240, y: 200 }, { x: 240, y: 120 })).toEqual({ x: 240, y: 120 })
  })
})

describe('wall items', () => {
  const room = ROOM_TEMPLATES[0].create()
  const inside = (f: ReturnType<typeof createFurniture>) => {
    const r = footprint(f)
    return r.x >= 0 && r.y >= 0 && r.x + r.w <= room.width && r.y + r.h <= room.height
  }

  it('has no seats, so they never count as places', () => {
    for (const type of ['door', 'window', 'board', 'whiteboard'] as const) {
      expect(isWallItem(type)).toBe(true)
      expect(createFurniture(type, 0, 0).seats).toEqual([])
    }
    expect(isWallItem('double')).toBe(false)
  })

  it('puts the board on the front wall, the door on the back wall and windows on the left wall', () => {
    const empty = { ...room, furniture: [] }
    expect(footprint(createFurnitureIn(empty, 'board')).y).toBe(0)
    expect(footprint(createFurnitureIn(empty, 'whiteboard')).y).toBe(0)
    const door = footprint(createFurnitureIn(empty, 'door'))
    expect(door.y + door.h).toBe(room.height)
    expect(footprint(createFurnitureIn(empty, 'window')).x).toBe(0)
    expect(inside(createFurnitureIn(empty, 'window'))).toBe(true)
  })

  it('slides a door along the back wall and still places it when the wall is full', () => {
    const empty = { ...room, furniture: [] }
    const first = createFurnitureIn(empty, 'door')
    const second = createFurnitureIn({ ...empty, furniture: [first] }, 'door')
    const [a, b] = [footprint(first), footprint(second)]
    expect(a.x + a.w <= b.x || b.x + b.w <= a.x).toBe(true)
    expect(b.y + b.h).toBe(room.height)

    const crowded = { ...empty, furniture: Array.from({ length: 30 }, () => createFurnitureIn(empty, 'door')) }
    expect(footprint(createFurnitureIn(crowded, 'door')).y + 24).toBe(room.height)
  })

  it('slides along the wall when the spot is taken', () => {
    const empty = { ...room, furniture: [] }
    const first = createFurnitureIn(empty, 'window')
    const second = createFurnitureIn({ ...empty, furniture: [first] }, 'window')
    const [a, b] = [footprint(first), footprint(second)]
    expect(a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true)
    expect(b.x).toBe(0)
  })

  it('every room template has a board and a door', () => {
    for (const { create } of ROOM_TEMPLATES.filter((t) => t.key !== 'empty')) {
      const types = create().furniture.map((f) => f.type)
      expect(types).toContain('board')
      expect(types).toContain('door')
    }
  })
})

describe('geometry', () => {
  it('footprint: a 90° rotation swaps width and height around the centre', () => {
    const furniture = createFurniture('double', 100, 100, 90)
    expect(footprint(furniture)).toEqual({ x: 154, y: 46, w: 92, h: 200 })
  })

  it('seatCenter rotates around the furniture centre', () => {
    const furniture = createFurniture('double', 0, 0, 90)
    expect(seatCenter(furniture, { dx: 50, dy: 0 })).toEqual({ x: 100, y: 46 + 50 })
  })

  it('snaps to neighbouring edges, else to the grid, and stays inside the room', () => {
    const room = { width: 1000, height: 800, grid: 10 }
    const neighbour = { x: 105, y: 0, w: 100, h: 100 }
    expect(snap({ x: 203, y: 300, w: 100, h: 50 }, [neighbour], room).dx).toBe(2)
    expect(snap({ x: 403, y: 307, w: 100, h: 50 }, [], room)).toEqual({ dx: -3, dy: 3 })
    expect(snap({ x: -40, y: 0, w: 100, h: 50 }, [], room).dx).toBe(40)
  })
})

describe('room templates', () => {
  it.each(ROOM_TEMPLATES)('$key fits in the room, without overlaps or duplicate seats', ({ create }) => {
    const room = create()
    const rects = room.furniture.map(footprint)
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(room.width)
      expect(r.y + r.h).toBeLessThanOrEqual(room.height)
    }
    rects.forEach((a, i) =>
      rects.slice(i + 1).forEach((b) => {
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap).toBe(false)
      }),
    )
    const ids = roomSeats(room).map((s) => s.seatId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('plan', () => {
  const room = ROOM_TEMPLATES[0].create()
  const schoolClass = newSchoolClass('A', 5)
  const plan: Plan = {
    id: 'p',
    name: 'p',
    classId: schoolClass.id,
    roomId: room.id,
    assignments: {},
    rules: [],
    status: 'draft',
    notes: '',
    createdAt: '',
    updatedAt: '',
  }
  const [seat1, seat2] = roomSeats(room).map((s) => s.seatId)
  const [student1, student2] = schoolClass.students.map((s) => s.id)

  it('assign moves, swaps and removes', () => {
    let assignments = assign({}, student1, seat1)
    assignments = assign(assignments, student2, seat2)
    expect(assign(assignments, student1, seat2)).toEqual({ [seat2]: student1, [seat1]: student2 }) // swap
    expect(assign(assignments, student1, null)).toEqual({ [seat2]: student2 })
    expect(assign(assignments, student1, seat1)).toEqual(assignments)
  })

  it('keeps the remaining members of a "together" group, and drops it below two', () => {
    const group = newSchoolClass('A', 3)
    const [x, y, z] = group.students.map((s) => s.id)
    const rule = (students: string[]) => ({ id: 'r', type: 'together' as const, students })
    expect(purgeRules([rule([x, y, 'gone'])], group)).toEqual([rule([x, y])])
    expect(purgeRules([rule([z, 'gone'])], group)).toEqual([])
  })

  it('drops damaged "together" rules and de-duplicates the members when loading a plan', () => {
    const loaded = normalizePlan({
      id: 'p',
      classId: 'c',
      roomId: 'r',
      rules: [
        { id: 'r1', type: 'together' },
        { id: 'r2', type: 'together', students: ['a', 'a'] },
        { id: 'r3', type: 'together', students: ['a', 'b', 'b', 4] },
        { id: 'r4', type: 'together', students: ['a', 'b', 'c', 'd'] },
      ],
    })
    expect(loaded.rules).toEqual([{ id: 'r3', type: 'together', students: ['a', 'b'] }])
  })

  it('purges orphan assignments', () => {
    const assignments = purgeAssignments(
      { ...plan, assignments: { [seat1]: student1, unknownSeat: student2, [seat2]: 'unknownStudent' } },
      schoolClass,
      room,
    )
    expect(assignments).toEqual({ [seat1]: student1 })
  })

  it('fills without duplicates and without overwriting', () => {
    const assignments = fillRandomly({ ...plan, assignments: { [seat1]: student1 } }, schoolClass, room)
    expect(assignments[seat1]).toBe(student1)
    expect(Object.values(assignments).sort()).toEqual(schoolClass.students.map((s) => s.id).sort())
  })
})

describe('randomLights', () => {
  it('gives 1-2 red, 5-6 orange, the rest green', () => {
    for (let i = 0; i < 200; i++) {
      const lights = randomLights(28)
      const count = (light: string) => lights.filter((l) => l === light).length
      expect(count('red')).toBeGreaterThanOrEqual(1)
      expect(count('red')).toBeLessThanOrEqual(2)
      expect(count('orange')).toBeGreaterThanOrEqual(5)
      expect(count('orange')).toBeLessThanOrEqual(6)
      expect(lights).toHaveLength(28)
    }
    expect(randomLights(3)).toHaveLength(3)
  })
})

/** Deterministic generator (mulberry32), so that placements are reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

describe('placing students with a strategy', () => {
  const room = findRoomTemplate('singles-6x5')!.create()
  const planOf = (assignments: Record<string, string> = {}): Plan => ({
    id: 'p',
    name: 'p',
    classId: 'c',
    roomId: room.id,
    assignments,
    rules: [],
    status: 'draft',
    notes: '',
    createdAt: '',
    updatedAt: '',
  })
  const sideNeighbours = (assignments: Record<string, string>, students: Student[]) => {
    const byId = new Map(students.map((s) => [s.id, s]))
    const seats = roomSeats(room).filter((s) => assignments[s.seatId])
    return seats.flatMap((a, i) =>
      seats
        .slice(i + 1)
        .filter((b) => relation(a, b) === 'side')
        .map((b) => [byId.get(assignments[a.seatId])!, byId.get(assignments[b.seatId])!] as const),
    )
  }

  it('alternates girls and boys side by side', () => {
    const schoolClass = newSchoolClass('A', 20)
    schoolClass.students.forEach((s, i) => (s.gender = i % 2 ? 'girl' : 'boy'))
    const assignments = fillRandomly(planOf(), schoolClass, room, seeded(1), 'alternate-gender')
    expect(Object.keys(assignments)).toHaveLength(20)
    const pairs = sideNeighbours(assignments, schoolClass.students)
    expect(pairs.length).toBeGreaterThan(0)
    expect(pairs.filter(([a, b]) => a.gender === b.gender)).toHaveLength(0)
  })

  it('never puts two red students side by side when it can be avoided', () => {
    const schoolClass = newSchoolClass('A', 20)
    schoolClass.students.slice(0, 4).forEach((s) => (s.light = 'red'))
    schoolClass.students.slice(4, 8).forEach((s) => (s.light = 'orange'))
    for (const seed of [1, 2, 3, 4, 5]) {
      const assignments = fillRandomly(planOf(), schoolClass, room, seeded(seed), 'spread-lights')
      const pairs = sideNeighbours(assignments, schoolClass.students)
      expect(pairs.filter(([a, b]) => a.light === 'red' && b.light === 'red')).toHaveLength(0)
    }
  })

  it('keeps the people already placed', () => {
    const schoolClass = newSchoolClass('A', 5)
    const [seat] = roomSeats(room)
    const assignments = fillRandomly(
      planOf({ [seat.seatId]: schoolClass.students[0].id }),
      schoolClass,
      room,
      seeded(3),
      'alternate-gender',
    )
    expect(assignments[seat.seatId]).toBe(schoolClass.students[0].id)
    expect(new Set(Object.values(assignments)).size).toBe(5)
  })
})

describe('transposeAssignments', () => {
  it('keeps people at the same relative place in a bigger room', () => {
    const small = findRoomTemplate('doubles-3x4')!.create()
    const big = findRoomTemplate('doubles-3x5')!.create()
    const seats = roomSeats(small)
    const first = seats[0]
    const last = seats[seats.length - 1]
    const result = transposeAssignments({ [first.seatId]: 'a', [last.seatId]: 'b' }, small, big)
    const bigSeats = roomSeats(big)
    expect(result[bigSeats[0].seatId]).toBe('a')
    expect(result[bigSeats[bigSeats.length - 1].seatId]).toBe('b')
  })

  it('leaves people without a seat when the new room is smaller', () => {
    const big = findRoomTemplate('singles-6x5')!.create()
    const tiny = findRoomTemplate('islands-3x2')!.create()
    const seats = roomSeats(big)
    const assignments = Object.fromEntries(seats.map((s, i) => [s.seatId, `s${i}`]))
    const result = transposeAssignments(assignments, big, tiny)
    expect(Object.keys(result)).toHaveLength(roomSeats(tiny).length)
    expect(new Set(Object.values(result)).size).toBe(Object.keys(result).length)
  })

  it('handles an empty plan and a room without seats', () => {
    const empty = findRoomTemplate('empty')!.create()
    const room = findRoomTemplate('doubles-3x4')!.create()
    expect(transposeAssignments({}, room, empty)).toEqual({})
    expect(transposeAssignments({ x: 'a' }, empty, room)).toEqual({})
  })
})

describe('normalizeStudent', () => {
  it('keeps the delegate when a file marks a student as both delegate and deputy', () => {
    const student = normalizeStudent({ id: 's', delegate: true, deputy: true })
    expect(student).toMatchObject({ delegate: true, deputy: false })
  })

  it('keeps a deputy who is not a delegate', () => {
    expect(normalizeStudent({ id: 's', deputy: true })).toMatchObject({ delegate: false, deputy: true })
  })
})
