import { describe, expect, it } from 'vitest'
import { DefaultCommand } from '../../src/commands/default'

describe('default command', () => {
  it('should export DefaultCommand class', () => {
    expect(typeof DefaultCommand).toBe('function')
  })
})
