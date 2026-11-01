import { describe, expect, it } from 'vitest'
import { emptyReception, receiveFrame, splitFrames, type Reception } from '../model/frames'
import { DATA_VERSION } from '../model/migrations'
import { buildPatch } from '../model/sync'
import { newSchoolClass, type Plan } from '../model/types'
import { decodePatch, encodePatch } from './patchCodec'

const plan: Plan = {
  id: 'p1',
  name: 'Plan',
  classId: 'c1',
  roomId: 'r1',
  assignments: {},
  rules: [],
  status: 'draft',
  notes: '',
  createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
}

describe('patch codec', () => {
  const schoolClass = newSchoolClass('A', 30)
  const classes = [{ ...schoolClass, students: schoolClass.students.map((s) => ({ ...s, updatedAt: plan.updatedAt })) }]
  const patch = buildPatch(classes, [plan], '2026-11-01T00:00:00.000Z', '2026-11-01T10:00:00.000Z')

  it('round-trips a patch', async () => {
    expect(await decodePatch(await encodePatch(patch))).toEqual(patch)
  })

  it('is much smaller than the plain JSON and QR-safe', async () => {
    const payload = await encodePatch(patch)
    expect(payload.length).toBeLessThan(JSON.stringify(patch).length / 2)
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('travels through frames', async () => {
    const frames = splitFrames(await encodePatch(patch), 't1', 200)
    expect(frames.length).toBeGreaterThan(1)
    const done = frames.reverse().reduce<Reception>(receiveFrame, emptyReception)
    if (done.status !== 'complete') throw new Error('expected a complete reception')
    expect((await decodePatch(done.payload)).version).toBe(DATA_VERSION)
  })

  it('refuses garbage with a readable error', async () => {
    await expect(decodePatch('not a patch')).rejects.toThrow('pas valides')
    await expect(decodePatch('')).rejects.toThrow('pas valides')
  })
})
