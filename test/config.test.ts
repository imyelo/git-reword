import { describe, it, expect } from 'vitest'
import { loadConfig, getProviderConfig, Config } from '../src/config'

describe('config', () => {
  it('should export loadConfig function', () => {
    expect(typeof loadConfig).toBe('function')
  })

  it('should export getProviderConfig function', () => {
    expect(typeof getProviderConfig).toBe('function')
  })

  it('should export Config type', () => {
    const config: Config = {
      provider: 'anthropic',
    }
    expect(config.provider).toBe('anthropic')
  })
})
