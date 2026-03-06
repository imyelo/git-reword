import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkFastForward, validateRewordOperation } from '../src/preflight'

vi.mock('../src/git/simple-git', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      raw: vi.fn(),
      status: vi.fn().mockResolvedValue({ files: [] }),
    })
  ),
  checkMergeBase: vi.fn(),
}))

import { checkMergeBase, getSimpleGit } from '../src/git/simple-git'

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

describe('validateRewordOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return valid when working tree is clean and fast-forward ok', async () => {
    vi.mocked(checkMergeBase).mockResolvedValue(true)

    const result = await validateRewordOperation({ last: 1 })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should return error when uncommitted changes exist', async () => {
    vi.mocked(getSimpleGit).mockResolvedValueOnce({
      raw: vi.fn(),
      status: vi.fn().mockResolvedValue({ files: ['dirty.ts'] }),
    } as never)
    vi.mocked(checkMergeBase).mockResolvedValue(true)

    const result = await validateRewordOperation({ last: 1 })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Uncommitted changes')
  })

  it('should return error when fast-forward check fails', async () => {
    vi.mocked(checkMergeBase).mockResolvedValue(false)

    const result = await validateRewordOperation({ last: 1 })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Cannot fast-forward')
  })

  it('should collect both errors when uncommitted changes and fast-forward both fail', async () => {
    vi.mocked(getSimpleGit).mockResolvedValueOnce({
      raw: vi.fn(),
      status: vi.fn().mockResolvedValue({ files: ['dirty.ts'] }),
    } as never)
    vi.mocked(checkMergeBase).mockResolvedValue(false)

    const result = await validateRewordOperation({ last: 1 })

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(2)
  })
})
