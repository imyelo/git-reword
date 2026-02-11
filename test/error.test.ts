import { describe, it, expect } from 'vitest'
import { GitRewordError, ErrorCode, handleError } from '../src/error'

describe('error handling', () => {
  it('should export GitRewordError class', () => {
    expect(typeof GitRewordError).toBe('function')
  })

  it('should export ErrorCode enum', () => {
    expect(typeof ErrorCode).toBe('object')
  })

  it('should export handleError function', () => {
    expect(typeof handleError).toBe('function')
  })
})
