import { describe, expect, it } from 'vitest'
import { askConfirm, askText } from './ask'

describe('questions', () => {
  it('cancels the pending question when a new one is asked', async () => {
    const first = askConfirm('First ?')
    const second = askText('Second ?', 'Name')
    void askConfirm('Third ?')
    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBeUndefined()
  })
})
