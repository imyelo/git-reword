import { describe, expect, it } from 'vitest'
import { BaseCommand } from '../../src/commands/base'

describe('base command', () => {
  it('should export BaseCommand class', () => {
    expect(typeof BaseCommand).toBe('function')
  })
})
