import { describe, it, expect } from 'vitest'
import { generateCommitMessage } from '../../src/ai/generator'

describe('ai generator', () => {
  it('should export generateCommitMessage function', () => {
    expect(typeof generateCommitMessage).toBe('function')
  })
})
