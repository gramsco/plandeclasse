import { describe, expect, it } from 'vitest'
import { emptyReception, progressOf, receiveFrame, splitFrames, type Reception } from './frames'

const scanAll = (frames: string[]) => frames.reduce<Reception>(receiveFrame, emptyReception)

describe('QR frames', () => {
  const payload = 'abcdefghij'.repeat(25) // 250 characters

  it('splits a payload into numbered frames', () => {
    const frames = splitFrames(payload, 't1', 100)
    expect(frames).toHaveLength(3)
    expect(frames[0]).toMatch(/^CLP1\.t1\.0\.3\./)
    expect(frames[2]).toMatch(/^CLP1\.t1\.2\.3\./)
  })

  it('sends a small payload as a single frame', () => {
    expect(splitFrames('abc', 't1')).toEqual(['CLP1.t1.0.1.abc'])
    expect(scanAll(splitFrames('abc', 't1'))).toEqual({ status: 'complete', payload: 'abc' })
  })

  it('reassembles the payload whatever the order and the repeats', () => {
    const [f0, f1, f2] = splitFrames(payload, 't1', 100)
    expect(scanAll([f2, f0, f0, f2, f1])).toEqual({ status: 'complete', payload })
  })

  it('reports progress while frames are missing', () => {
    const [f0, , f2] = splitFrames(payload, 't1', 100)
    expect(progressOf(scanAll([f0, f0, f2]))).toEqual({ received: 2, total: 3 })
    expect(progressOf(emptyReception)).toBeUndefined()
  })

  it('ignores texts that are not frames', () => {
    const [f0] = splitFrames(payload, 't1', 100)
    const state = scanAll([f0, 'https://example.org', 'CLP1.t1.9.3.x', 'CLP1.t1.0.0.x', 'CLP1..0.3.x', 'CLP1.t1.a.3.x'])
    expect(progressOf(state)).toEqual({ received: 1, total: 3 })
  })

  it('starts over when the sender begins another transfer', () => {
    const old = splitFrames(payload, 'old', 100)
    const fresh = splitFrames('new payload', 'new', 100)
    const state = scanAll([old[0], old[1], fresh[0]])
    expect(state).toEqual({ status: 'complete', payload: 'new payload' })
  })

  it('keeps dots that belong to the chunk', () => {
    expect(scanAll(['CLP1.t.0.1.a.b.c'])).toEqual({ status: 'complete', payload: 'a.b.c' })
  })
})
