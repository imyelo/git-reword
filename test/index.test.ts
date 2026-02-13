import { describe, expect, it } from 'vitest'
import MainCommand from '../src/index'

describe('main entry', () => {
  it('should export main command', () => {
    expect(MainCommand).toBeDefined()
  })
})
