import { generateObject } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCommitMessage } from '../../src/ai/generator'
import type { Config } from '../../src/config.js'

vi.mock('../../src/git/simple-git.js', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      show: vi.fn().mockResolvedValue('diff --git a/test.ts b/test.ts\n+console.log("test")'),
    })
  ),
}))

vi.mock('ai', () => ({ generateObject: vi.fn() }))

describe('ai generator retry', () => {
  const baseConfig: Config = { provider: 'openai', model: 'gpt-4o' }
  const commit = { hash: 'abc123', shortHash: 'abc123', message: 'fix bug', body: undefined }
  const success = { object: { subject: 'fix(auth): resolve login timeout', body: '' } } as never

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should retry on rate limit error (429)', async () => {
    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error('Rate limit exceeded (429)'))
      .mockRejectedValueOnce(new Error('Rate limit exceeded (429)'))
      .mockResolvedValueOnce(success)

    const result = await generateCommitMessage(commit, baseConfig)
    expect(result.subject).toBe('fix(auth): resolve login timeout')
    expect(generateObject).toHaveBeenCalledTimes(3)
  })

  it('should retry on server errors (500, 502, 503)', async () => {
    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error('Internal server error (500)'))
      .mockRejectedValueOnce(new Error('Bad gateway (502)'))
      .mockResolvedValueOnce(success)

    const result = await generateCommitMessage(commit, baseConfig)
    expect(result.subject).toBe('fix(auth): resolve login timeout')
    expect(generateObject).toHaveBeenCalledTimes(3)
  })

  it('should retry on network errors', async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValueOnce(success)

    const result = await generateCommitMessage(commit, baseConfig)
    expect(result.subject).toBe('fix(auth): resolve login timeout')
    expect(generateObject).toHaveBeenCalledTimes(2)
  })

  it('should throw after max retries', async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error('Rate limit exceeded (429)'))

    await expect(generateCommitMessage(commit, baseConfig)).rejects.toThrow('Rate limit exceeded (429)')
    expect(generateObject).toHaveBeenCalledTimes(3)
  })

  it('should not retry on non-retryable errors', async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error('Invalid API key'))

    await expect(generateCommitMessage(commit, baseConfig)).rejects.toThrow('Invalid API key')
    expect(generateObject).toHaveBeenCalledTimes(1)
  })
})
