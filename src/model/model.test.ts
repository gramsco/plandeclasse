import { describe, expect, it } from 'vitest'
import { randomLights } from './demo'
import { footprint, roomSeats, seatCenter, snap } from './geometry'
import { assign, fillRandomly, purgeAssignments } from './plan'
import { createFurniture, ROOM_TEMPLATES } from './rooms'
import { newSchoolClass, type Plan } from './types'

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
