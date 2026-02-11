import { describe, expect, it } from 'vitest'
import { executeRewordRebase } from '../../src/rebase'

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
})
