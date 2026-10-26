import { describe, expect, it } from 'vitest'
import { moveItem, sortByIds } from './order'

const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (list: { id: string }[]) => list.map((x) => x.id)

describe('moveItem', () => {
  it('moves an item down onto another one', () => expect(ids(moveItem(items, 'a', 'c'))).toEqual(['b', 'c', 'a', 'd']))
  it('moves an item up onto another one', () => expect(ids(moveItem(items, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c']))
  it('ignores unknown ids and drops on itself', () => {
    expect(moveItem(items, 'a', 'a')).toBe(items)
    expect(moveItem(items, 'x', 'a')).toBe(items)
  })
})

describe('sortByIds', () => {
  it('follows the saved order and puts unknown items last', () =>
    expect(ids(sortByIds(items, ['c', 'gone', 'a']))).toEqual(['c', 'a', 'b', 'd']))
})
