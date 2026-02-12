import { describe, expect, it } from 'vitest'
import { executeRewordRebase, type RewordResult } from '../../src/rebase'

describe('rebase executor', () => {
  it('should export executeRewordRebase function', async () => {
    const { executeRewordRebase } = await import('../../src/rebase')
    expect(typeof executeRewordRebase).toBe('function')
  })

  it('should return empty array for empty commits', async () => {
    const { executeRewordRebase } = await import('../../src/rebase')
    const results = await executeRewordRebase([])
    expect(results).toEqual([])
  })
})
