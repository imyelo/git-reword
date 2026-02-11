import { describe, expect, it } from 'vitest'
import type { AiProvider, Commit, RewordOptions } from '../src/types'

describe('types', () => {
  it('should export RewordOptions interface', () => {
    const options: RewordOptions = {
      last: 3,
      dryRun: true,
      yes: false,
    }
    expect(options.last).toBe(3)
  })

  it('should export Commit interface', () => {
    const commit: Commit = {
      hash: 'abc123',
      shortHash: 'abc1234',
      message: 'fix: bug',
      body: '',
    }
    expect(commit.hash).toBe('abc123')
  })

  it('should export AiProvider type', () => {
    const provider: AiProvider = 'anthropic'
    expect(provider).toBe('anthropic')
  })
})
