import { describe, expect, it } from 'vitest'
import { formatError, formatPreview, formatResult } from '../src/output'

describe('output formatter', () => {
  it('should export formatPreview function', () => {
    expect(typeof formatPreview).toBe('function')
  })

  it('should export formatResult function', () => {
    expect(typeof formatResult).toBe('function')
  })

  it('should export formatError function', () => {
    expect(typeof formatError).toBe('function')
  })
})
