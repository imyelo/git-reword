import { describe, it, expect } from 'vitest'
import { validateRewordOperation, checkFastForward } from '../src/preflight'

describe('preflight', () => {
  it('should export validateRewordOperation function', () => {
    expect(typeof validateRewordOperation).toBe('function')
  })

  it('should export checkFastForward function', () => {
    expect(typeof checkFastForward).toBe('function')
  })
})
