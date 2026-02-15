import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCommitMessage } from '../../src/ai/generator'
import type { Config } from '../../src/config.js'

// Mock simple-git
vi.mock('../../src/git/simple-git.js', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      show: vi.fn().mockResolvedValue('diff --git a/test.ts b/test.ts\n+console.log("test")'),
    })
  ),
}))

// Mock AI SDK - we need to mock at module level before importing generator
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

describe('ai generator retry', () => {
  const baseConfig: Config = {
    provider: 'openai',
    model: 'gpt-4o',
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Re-mock the generateObject for each test
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockReset()
  })

  it('should retry on rate limit error (429)', async () => {
    const { generateObject } = await import('ai')

    // First two calls fail with 429, third succeeds
    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error('Rate limit exceeded (429)'))
      .mockRejectedValueOnce(new Error('Rate limit exceeded (429)'))
      .mockResolvedValueOnce(
        // @ts-expect-error - Mock doesn't need full type
        { object: { subject: 'fix(auth): resolve login timeout', body: '' } }
      )

    const commit = {
      hash: 'abc123',
      shortHash: 'abc123',
      message: 'fix bug',
      body: undefined,
    }

    const result = await generateCommitMessage(commit, baseConfig)

    expect(result.subject).toBe('fix(auth): resolve login timeout')
    expect(generateObject).toHaveBeenCalledTimes(3)
  })

  it('should retry on server errors (500, 502, 503)', async () => {
    const { generateObject } = await import('ai')

    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error('Internal server error (500)'))
      .mockRejectedValueOnce(new Error('Bad gateway (502)'))
      .mockResolvedValueOnce(
        // @ts-expect-error - Mock doesn't need full type
        { object: { subject: 'fix(auth): resolve login timeout', body: '' } }
      )

    const commit = {
      hash: 'abc123',
      shortHash: 'abc123',
      message: 'fix bug',
      body: undefined,
    }

    const result = await generateCommitMessage(commit, baseConfig)

    expect(result.subject).toBe('fix(auth): resolve login timeout')
    expect(generateObject).toHaveBeenCalledTimes(3)
  })

  it('should retry on network errors', async () => {
    const { generateObject } = await import('ai')

    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(
        // @ts-expect-error - Mock doesn't need full type
        { object: { subject: 'fix(auth): resolve login timeout', body: '' } }
      )

    const commit = {
      hash: 'abc123',
      shortHash: 'abc123',
      message: 'fix bug',
      body: undefined,
    }

    const result = await generateCommitMessage(commit, baseConfig)

    expect(result.subject).toBe('fix(auth): resolve login timeout')
    expect(generateObject).toHaveBeenCalledTimes(2)
  })

  it('should throw after max retries', async () => {
    const { generateObject } = await import('ai')

    vi.mocked(generateObject).mockRejectedValue(new Error('Rate limit exceeded (429)'))

    const commit = {
      hash: 'abc123',
      shortHash: 'abc123',
      message: 'fix bug',
      body: undefined,
    }

    await expect(generateCommitMessage(commit, baseConfig)).rejects.toThrow('Rate limit exceeded (429)')
    expect(generateObject).toHaveBeenCalledTimes(3) // MAX_RETRIES = 3
  })

  it('should not retry on non-retryable errors', async () => {
    const { generateObject } = await import('ai')

    vi.mocked(generateObject).mockRejectedValue(new Error('Invalid API key'))

    const commit = {
      hash: 'abc123',
      shortHash: 'abc123',
      message: 'fix bug',
      body: undefined,
    }

    await expect(generateCommitMessage(commit, baseConfig)).rejects.toThrow('Invalid API key')
    expect(generateObject).toHaveBeenCalledTimes(1) // Only called once, no retry
  })
})
