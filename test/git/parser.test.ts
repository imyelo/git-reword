import { describe, expect, it } from 'vitest'
import { getCommitRange, type RewordOptions } from '../../src/git/parser'

describe('git parser', () => {
  describe('getCommitRange', () => {
    it('should export getCommitRange function', () => {
      expect(typeof getCommitRange).toBe('function')
    })

    it('should return correct range for --last option', () => {
      const result = getCommitRange({ last: 3 } as RewordOptions)
      expect(result).not.toBeNull()
      expect(result?.from).toBe('HEAD~3')
      expect(result?.to).toBe('HEAD')
    })

    it('should return correct range for --since option', () => {
      const result = getCommitRange({ since: 'abc123' } as RewordOptions)
      expect(result).not.toBeNull()
      expect(result?.from).toBe('abc123')
      expect(result?.to).toBe('HEAD')
    })

    it('should return correct range for --range option', () => {
      const result = getCommitRange({ range: 'abc123..def456' } as RewordOptions)
      expect(result).not.toBeNull()
      expect(result?.from).toBe('abc123')
      expect(result?.to).toBe('def456')
    })

    it('should return correct range for --commit option', () => {
      const result = getCommitRange({ commit: 'abc123' } as RewordOptions)
      expect(result).not.toBeNull()
      expect(result?.from).toBe('abc123^')
      expect(result?.to).toBe('abc123')
    })

    it('should return null when no options provided', () => {
      expect(getCommitRange({} as RewordOptions)).toBeNull()
    })
  })
})
