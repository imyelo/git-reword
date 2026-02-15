import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkFastForward, validateRewordOperation } from '../src/preflight'

// Mock the entire simple-git module including checkMergeBase
vi.mock('../src/git/simple-git', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      raw: vi.fn(),
    })
  ),
  checkMergeBase: vi.fn(),
}))

import { checkMergeBase, getSimpleGit } from '../src/git/simple-git'

describe('preflight', () => {
  it('should export validateRewordOperation function', () => {
    expect(typeof validateRewordOperation).toBe('function')
  })

  it('should export checkFastForward function', () => {
    expect(typeof checkFastForward).toBe('function')
  })

  describe('checkFastForward', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should return true when commit is reachable (is ancestor)', async () => {
      ;(checkMergeBase as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      const result = await checkFastForward({ commit: 'abc123' })

      expect(result).toBe(true)
      expect(checkMergeBase).toHaveBeenCalled()
    })

    it('should return false when commit is not reachable (not ancestor)', async () => {
      ;(checkMergeBase as ReturnType<typeof vi.fn>).mockResolvedValue(false)

      const result = await checkFastForward({ commit: 'abc123' })

      expect(result).toBe(false)
    })

    it('should return true for --last option when commits are reachable', async () => {
      ;(checkMergeBase as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      const result = await checkFastForward({ last: 3 })

      expect(result).toBe(true)
      expect(checkMergeBase).toHaveBeenCalled()
    })

    it('should return true for --since option when commit is ancestor', async () => {
      ;(checkMergeBase as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      const result = await checkFastForward({ since: 'abc123' })

      expect(result).toBe(true)
    })

    it('should check from commit for --range option', async () => {
      ;(checkMergeBase as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      const result = await checkFastForward({ range: 'abc123..def456' })

      expect(result).toBe(true)
      expect(checkMergeBase).toHaveBeenCalled()
    })

    it('should return true when no options provided (default HEAD)', async () => {
      const result = await checkFastForward({})

      expect(result).toBe(true)
      expect(checkMergeBase).not.toHaveBeenCalled()
    })
  })
})
