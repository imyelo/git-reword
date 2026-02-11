import { describe, expect, it } from 'vitest'
import { StagedCommand } from '../../src/commands/staged'

describe('staged command', () => {
  it('should export StagedCommand class', () => {
    expect(typeof StagedCommand).toBe('function')
  })
})
