import { generateObject } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCommitMessage, generateStagedMessage } from '../../src/ai/generator'
import type { Config } from '../../src/config.js'

vi.mock('../../src/git/simple-git.js', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      show: vi.fn().mockResolvedValue('diff --git a/test.ts b/test.ts\n+console.log("test")'),
    })
  ),
}))

vi.mock('ai', () => ({ generateObject: vi.fn() }))

describe('ai generator', () => {
  const baseConfig: Config = { provider: 'openai', model: 'gpt-4o' }
  const commit = { hash: 'abc123', shortHash: 'abc123', message: 'fix bug', body: undefined }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate commit message for a given commit', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { subject: 'fix(auth): resolve login timeout', body: '', reasoning: 'More specific scope' },
    } as never)

    const result = await generateCommitMessage(commit, baseConfig)

    expect(result.subject).toBe('fix(auth): resolve login timeout')
    expect(result.body).toBe('')
    expect(result.reasoning).toBe('More specific scope')
    expect(generateObject).toHaveBeenCalledTimes(1)
  })

  it('should generate message for staged changes', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { subject: 'feat(ui): add new button component', body: 'Added a new button component with hover states' },
    } as never)

    const result = await generateStagedMessage(
      'diff --git a/button.ts b/button.ts\n+export const Button = () => {}',
      baseConfig
    )

    expect(result.subject).toBe('feat(ui): add new button component')
    expect(result.body).toBe('Added a new button component with hover states')
  })

  it('should work with different providers', async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: { subject: 'chore: update config', body: '' } } as never)

    const result = await generateCommitMessage(
      { ...commit, hash: 'def456', shortHash: 'def456', message: 'update stuff' },
      { provider: 'anthropic', model: 'claude-sonnet-4' }
    )

    expect(result.subject).toBe('chore: update config')
  })

  it('should return undefined reasoning when not in response', async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: { subject: 'docs: update readme', body: '' } } as never)

    const result = await generateCommitMessage(
      { ...commit, message: 'update docs', body: 'detailed explanation' },
      baseConfig
    )

    expect(result.subject).toBe('docs: update readme')
    expect(result.reasoning).toBeUndefined()
  })

  it('should call generateObject when no model specified', async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: { subject: 'refactor: simplify code', body: '' } } as never)

    await generateCommitMessage(commit, { provider: 'openai' })

    expect(generateObject).toHaveBeenCalledTimes(1)
  })
})
