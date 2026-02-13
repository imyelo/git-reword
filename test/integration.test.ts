import { describe, expect, it } from 'vitest'
import MainCommand from '../src/index'

describe('integration', () => {
  it('should export main command', () => {
    expect(MainCommand).toBeDefined()
  })

  it('should export command from index', () => {
    expect(MainCommand).toBeDefined()
  })
})
