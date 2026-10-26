import { describe, expect, it } from 'vitest'
import { matchesSearch } from './search'

describe('matchesSearch', () => {
  it('ignores case and accents on both sides', () => {
    expect(matchesSearch('Éloïse Martin', 'eloise')).toBe(true)
    expect(matchesSearch('Eloise Martin', 'ÉLOÏSE')).toBe(true)
  })

  it('matches everything on an empty or blank query', () => {
    expect(matchesSearch('Ada', '')).toBe(true)
    expect(matchesSearch('Ada', '  ')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(matchesSearch('Ada Lovelace', 'sam')).toBe(false)
  })
})
