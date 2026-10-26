import { describe, expect, it } from 'vitest'
import { LEGACY_V1, LEGACY_V2, LEGACY_V3 } from './legacyFixtures'
import { DATA_VERSION, migrate, toRawData } from './migrations'

describe('migrations', () => {
  it('renames every field and value from data version 2 on', () => {
    const data = migrate(LEGACY_V2, 2)
    expect(data.classes[0]).toEqual({
      id: 'c1',
      name: '6e A',
      students: [
        {
          id: 'e1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          photoId: undefined,
          annotations: ['PAP'],
          light: 'red',
          gender: 'girl',
          role: 'student',
          supports: [],
          delegate: false,
        },
        {
          id: 'e2',
          firstName: 'Sam',
          lastName: '',
          photoId: undefined,
          annotations: [],
          light: 'green',
          gender: undefined,
          role: 'aesh',
          supports: ['e1'],
          delegate: false,
        },
      ],
    })
    expect(data.rooms[0]).toEqual({
      id: 's1',
      name: 'Salle 12',
      width: 1200,
      height: 800,
      grid: 10,
      furniture: [
        {
          id: 'm1',
          type: 'island',
          x: 10,
          y: 20,
          rotation: 90,
          width: 200,
          height: 184,
          seats: [{ id: 'p1', dx: 1, dy: 2 }],
        },
      ],
    })
    expect(data.plans[0]).toEqual({
      id: 'p1',
      name: 'Plan',
      classId: 'c1',
      roomId: 's1',
      assignments: { p1: 'e1' },
      rules: [
        { id: 'r1', type: 'separate', studentA: 'e1', studentB: 'e2' },
        { id: 'r2', type: 'colors', a: 'red', b: 'orange' },
        { id: 'r3', type: 'influence', student: 'e1', near: 'e2', becomes: 'orange' },
      ],
      status: 'testing',
      notes: 'n',
      parentId: 'p0',
      createdAt: '2026-01-01',
      testingSince: '2026-01-02',
    })
  })

  it('marks nobody as a class representative from data version 3 to 4', () => {
    const data = migrate(LEGACY_V3, 3) as { classes: { students: { delegate: boolean; firstName: string }[] }[] }
    expect(data.classes[0].students).toEqual([
      expect.objectContaining({ firstName: 'Ada', delegate: false }),
      expect.objectContaining({ firstName: 'Sam', delegate: false }),
    ])
    expect(migrate(LEGACY_V3, 3).plans).toEqual(LEGACY_V3.plans)
  })

  it('chains from version 1 up to the current version', () => {
    const data = migrate(LEGACY_V1, 1) as { classes: { students: { light: string }[] }[]; plans: { status: string }[] }
    expect(data.classes[0].students[0].light).toBe('green')
    expect(data.plans[0].status).toBe('draft')
  })

  it('leaves current data untouched', () => {
    const current = { classes: [{ id: 'x' }], rooms: [{ id: 'y' }], plans: [] }
    expect(migrate(current, DATA_VERSION)).toEqual(current)
  })

  it('puts rooms under the key their version used', () => {
    const data = { classes: [], rooms: [1], plans: [] }
    expect(toRawData(2, data)).toEqual({ classes: [], salles: [1], plans: [] }) // lang-ignore: legacy key
    expect(toRawData(3, data)).toEqual({ classes: [], rooms: [1], plans: [] })
  })
})
