import { describe, expect, it } from 'vitest'
import { getProviderConfig } from '../src/config'

describe('getProviderConfig', () => {
  it('should default provider to openai when not configured', () => {
    expect(getProviderConfig({})).toMatchObject({ provider: 'openai' })
  })

  it('should use the configured provider', () => {
    expect(getProviderConfig({ provider: 'anthropic' })).toMatchObject({ provider: 'anthropic' })
    expect(getProviderConfig({ provider: 'google' })).toMatchObject({ provider: 'google' })
  })

  it('should pass through model, apiKey, and baseUrl', () => {
    const result = getProviderConfig({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      baseUrl: 'https://custom.api',
    })
    expect(result).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      baseUrl: 'https://custom.api',
    })
  })

  it('should leave optional fields undefined when not set', () => {
    const result = getProviderConfig({ provider: 'openai' })
    expect(result.model).toBeUndefined()
    expect(result.apiKey).toBeUndefined()
    expect(result.baseUrl).toBeUndefined()
  })
})
