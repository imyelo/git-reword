import { describe, expect, it } from 'vitest'
import { getCommitRange, type RewordOptions } from '../../src/git/parser'

describe('getCommitRange', () => {
  it('should return HEAD~N..HEAD for --last', () => {
    expect(getCommitRange({ last: 3 } as RewordOptions)).toEqual({ from: 'HEAD~3', to: 'HEAD' })
  })

  it('should return ref..HEAD for --since', () => {
    expect(getCommitRange({ since: 'abc123' } as RewordOptions)).toEqual({ from: 'abc123', to: 'HEAD' })
  })

  it('should split from..to for --range', () => {
    expect(getCommitRange({ range: 'abc123..def456' } as RewordOptions)).toEqual({ from: 'abc123', to: 'def456' })
  })

  it('should return commit^..commit for --commit', () => {
    expect(getCommitRange({ commit: 'abc123' } as RewordOptions)).toEqual({ from: 'abc123^', to: 'abc123' })
  })

  it('should return null when no option is provided', () => {
    expect(getCommitRange({} as RewordOptions)).toBeNull()
  })
})
