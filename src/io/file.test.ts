import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../storage/memory'
import { newSchoolClass } from '../model/types'
import { buildTransfer } from './file'

describe('buildTransfer', () => {
  const setup = async () => {
    const storage = memoryStorage()
    const schoolClass = newSchoolClass('6e A', 1)
    schoolClass.students[0].photoId = 'p1'
    await storage.putPhoto('p1', new Blob(['jpeg'], { type: 'image/jpeg' }))
    return { storage, data: { classes: [schoolClass], rooms: [], plans: [] }, id: schoolClass.id }
  }

  it('leaves the photos out unless a storage is given', async () => {
    const { data, id } = await setup()
    expect((await buildTransfer(data, [id])).photos).toEqual({})
  })

  it('carries the photos of the chosen classes when a storage is given', async () => {
    const { storage, data, id } = await setup()
    const transfer = await buildTransfer(data, [id], storage)
    expect(Object.keys(transfer.photos)).toEqual(['p1'])
  })
})
