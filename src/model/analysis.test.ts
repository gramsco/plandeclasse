import { describe, expect, it } from 'vitest'
import { analyze, relation } from './analysis'
import { roomSeats } from './geometry'
import { ROOM_TEMPLATES } from './rooms'
import { newAesh, newId, newSchoolClass, type Plan, type Rule } from './types'

describe('relation', () => {
  it('detects side, front, diagonal and aisle', () => {
    const origin = { x: 0, y: 0 }
    expect(relation(origin, { x: 100, y: 0 })).toBe('side')
    expect(relation(origin, { x: 0, y: 120 })).toBe('front')
    expect(relation(origin, { x: 100, y: 120 })).toBe('diagonal')
    expect(relation(origin, { x: 160, y: 0 })).toBe('aisle')
    expect(relation(origin, { x: 400, y: 0 })).toBeNull()
  })

  it('takes seat orientation into account (column of a U shape)', () => {
    const seat = { x: 0, y: 0, rotation: 90 }
    expect(relation(seat, { x: 0, y: 108 })).toBe('side')
  })
})

describe('analyze', () => {
  const room = ROOM_TEMPLATES[0].create() // double tables
  const seats = roomSeats(room)
  const [seat1, seat2] = seats.filter((s) => s.y === seats[0].y).slice(0, 2) // same table: side by side
  const farSeat = seats[seats.length - 1]
  const schoolClass = newSchoolClass('A', 3)
  const [a, b, c] = schoolClass.students
  const plan = (assignments: Record<string, string>, rules: Rule[] = []): Plan => ({
    id: 'p',
    name: 'p',
    classId: schoolClass.id,
    roomId: room.id,
    assignments,
    rules,
    status: 'draft',
    notes: '',
    createdAt: '',
  })

  it('"separate" rule: error when side by side', () => {
    const rules: Rule[] = [{ id: newId(), type: 'separate', studentA: a.id, studentB: b.id }]
    const result = analyze(plan({ [seat1.seatId]: a.id, [seat2.seatId]: b.id }, rules), schoolClass, room)
    expect(result.alerts[0].level).toBe('error')
    expect(result.links).toHaveLength(1)
  })

  it('"together" rule: warns when the placed members are far apart, silent when close', () => {
    const rules: Rule[] = [{ id: newId(), type: 'together', students: [a.id, b.id, c.id] }]
    const far = analyze(plan({ [seat1.seatId]: a.id, [farSeat.seatId]: b.id }, rules), schoolClass, room)
    expect(far.alerts.map((x) => x.level)).toEqual(['warning'])
    expect(far.alerts[0].studentIds).toEqual([a.id, b.id])
    const close = analyze(plan({ [seat1.seatId]: a.id, [seat2.seatId]: b.id }, rules), schoolClass, room)
    expect(close.alerts).toEqual([])
  })

  it('"colors" rule: red next to red', () => {
    a.light = 'red'
    b.light = 'red'
    const rules: Rule[] = [{ id: newId(), type: 'colors', a: 'red', b: 'red' }]
    const result = analyze(plan({ [seat1.seatId]: a.id, [seat2.seatId]: b.id }, rules), schoolClass, room)
    expect(result.alerts.some((x) => x.level === 'error')).toBe(true)
    a.light = 'green'
    b.light = 'green'
  })

  it('words the alerts with French colour names', () => {
    a.light = 'red'
    b.light = 'orange'
    const rules: Rule[] = [
      { id: newId(), type: 'colors', a: 'red', b: 'orange' },
      { id: newId(), type: 'colors', a: 'orange', b: 'orange' },
    ]
    const messages = analyze(plan({ [seat1.seatId]: a.id, [seat2.seatId]: b.id }, rules), schoolClass, room).alerts.map(
      (x) => x.message,
    )
    expect(messages[0]).toMatch(/^rouge et orange : /)
    expect(messages.join(' ')).not.toMatch(/\b(red|green)\b/)
    a.light = 'green'
    b.light = 'green'
  })

  it('influence turns a green student orange nearby, but not far away', () => {
    const rules: Rule[] = [{ id: newId(), type: 'influence', student: a.id, near: b.id, becomes: 'orange' }]
    const near = analyze(plan({ [seat1.seatId]: a.id, [seat2.seatId]: b.id }, rules), schoolClass, room)
    const far = analyze(plan({ [seat1.seatId]: a.id, [farSeat.seatId]: b.id }, rules), schoolClass, room)
    expect(near.effectiveLight[a.id]).toBe('orange')
    expect(far.effectiveLight[a.id]).toBe('green')
  })

  it('AESH: unplaced = warning, too far = error, close = link', () => {
    const aesh = newAesh('Sam')
    aesh.supports = [c.id]
    schoolClass.students.push(aesh)
    expect(analyze(plan({ [seat1.seatId]: c.id }), schoolClass, room).alerts[0]).toMatchObject({ level: 'warning' })
    expect(
      analyze(plan({ [seat1.seatId]: c.id, [farSeat.seatId]: aesh.id }), schoolClass, room).alerts[0],
    ).toMatchObject({
      level: 'error',
    })
    const close = analyze(plan({ [seat1.seatId]: c.id, [seat2.seatId]: aesh.id }), schoolClass, room)
    expect(close.alerts).toHaveLength(0)
    expect(close.links[0].type).toBe('aesh')
    schoolClass.students.pop()
  })
})
