import { describe, expect, it } from 'vitest'
import { generateRewrites } from '../../src/commands/default'

describe('generateRewrites export', () => {
  it('should export generateRewrites function', () => {
    expect(typeof generateRewrites).toBe('function')
  })
})
