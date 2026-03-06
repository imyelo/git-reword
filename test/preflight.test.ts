import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkFastForward } from '../src/preflight'

// Mock the entire simple-git module including checkMergeBase
vi.mock('../src/git/simple-git', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      raw: vi.fn(),
    })
  ),
  checkMergeBase: vi.fn(),
}))

import { checkMergeBase } from '../src/git/simple-git'

describe('checkFastForward', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when commit is reachable', async () => {
    vi.mocked(checkMergeBase).mockResolvedValue(true)
    expect(await checkFastForward({ commit: 'abc123' })).toBe(true)
    expect(checkMergeBase).toHaveBeenCalled()
  })

  it('should return false when commit is not reachable', async () => {
    vi.mocked(checkMergeBase).mockResolvedValue(false)
    expect(await checkFastForward({ commit: 'abc123' })).toBe(false)
  })

  it('should check merge base for --last', async () => {
    vi.mocked(checkMergeBase).mockResolvedValue(true)
    expect(await checkFastForward({ last: 3 })).toBe(true)
    expect(checkMergeBase).toHaveBeenCalled()
  })

  it('should check merge base for --since', async () => {
    vi.mocked(checkMergeBase).mockResolvedValue(true)
    expect(await checkFastForward({ since: 'abc123' })).toBe(true)
  })

  it('should check merge base for --range', async () => {
    vi.mocked(checkMergeBase).mockResolvedValue(true)
    expect(await checkFastForward({ range: 'abc123..def456' })).toBe(true)
    expect(checkMergeBase).toHaveBeenCalled()
  })

  it('should return true without calling checkMergeBase when no option given', async () => {
    expect(await checkFastForward({})).toBe(true)
    expect(checkMergeBase).not.toHaveBeenCalled()
  })
})
