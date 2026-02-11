import { describe, expect, it } from 'vitest'
import { main } from '../src/index'

describe('integration', () => {
  it('should export main function', () => {
    expect(typeof main).toBe('function')
  })

  it('should export main from index', () => {
    expect(main).toBeDefined()
  })
})
