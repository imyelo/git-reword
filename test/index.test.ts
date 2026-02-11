import { describe, expect, it } from 'vitest'
import { main } from '../src/index'

describe('main entry', () => {
  it('should export main function', () => {
    expect(typeof main).toBe('function')
  })
})
