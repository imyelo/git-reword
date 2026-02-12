import { describe, expect, it } from 'vitest'
import MainCommand from '../../src/commands/default'

describe('default command', () => {
  it('should export MainCommand class', () => {
    expect(typeof MainCommand).toBe('function')
  })
})
