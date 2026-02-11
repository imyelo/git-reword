import { describe, expect, it } from 'vitest'
import { checkFastForward, validateRewordOperation } from '../src/preflight'

describe('preflight', () => {
  it('should export validateRewordOperation function', () => {
    expect(typeof validateRewordOperation).toBe('function')
  })

  it('should export checkFastForward function', () => {
    expect(typeof checkFastForward).toBe('function')
  })
})
