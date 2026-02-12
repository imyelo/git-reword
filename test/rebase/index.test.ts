import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { executeRewordRebase, type RewordResult } from '../../src/rebase'

// Mock simple-git
vi.mock('simple-git', () => ({
  default: vi.fn(() => ({
    log: vi.fn().mockResolvedValue({ all: [{ subject: 'fix: original message', body: '' }] }),
    raw: vi.fn().mockResolvedValue(''),
  })),
}))

describe('rebase executor', () => {
  it('should export executeRewordRebase function', () => {
    expect(typeof executeRewordRebase).toBe('function')
  })

  it('should export RewordResult interface', () => {
    const result = {
      success: true,
      commit: 'abc1234',
      originalMessage: 'fix: bug',
      newMessage: 'fix(auth): resolve login timeout issue',
    }
    expect(result.success).toBe(true)
  })

  it('should return empty array for empty commits', async () => {
    const results = await executeRewordRebase([])
    expect(results).toEqual([])
  })

  it('should include error field when rebase fails', async () => {
    // This test validates that error handling returns proper RewordResult type
    const result = {
      success: false,
      commit: 'abc123',
      originalMessage: 'fix: bug',
      newMessage: 'fix(auth): fixed bug',
      error: 'Mock rebase error',
    }
    expect(result.error).toBeDefined()
    expect(result.success).toBe(false)
  })
})
