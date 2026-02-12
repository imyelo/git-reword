import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCommitMessage, generateStagedMessage } from '../../src/ai/generator'
import type { Config } from '../../src/config.js'

// Mock simple-git
vi.mock('../../src/git/simple-git.js', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      show: vi.fn().mockResolvedValue('diff --git a/test.ts b/test.ts\n+console.log("test")'),
    })
  ),
}))

// Mock AI SDK
vi.mock('ai', async () => {
  return {
    generateText: vi.fn(),
    Output: {
      object: vi.fn(),
    },
  }
})

describe('ai generator', () => {
  const baseConfig: Config = {
    provider: 'openai',
    model: 'gpt-4o',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate commit message for a given commit', async () => {
    const { generateText } = await import('ai')

    ;(generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({ message: 'fix(auth): resolve login timeout', reasoning: 'More specific scope' }),
    })

    const commit = {
      hash: 'abc123',
      shortHash: 'abc123',
      message: 'fix bug',
      body: undefined,
    }

    const result = await generateCommitMessage(commit, baseConfig)

    expect(result.message).toBe('fix(auth): resolve login timeout')
    expect(result.reasoning).toBe('More specific scope')
    expect(generateText).toHaveBeenCalledTimes(1)
  })

  it('should generate message for staged changes', async () => {
    const { generateText } = await import('ai')

    ;(generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({ message: 'feat(ui): add new button component' }),
    })

    const diff = 'diff --git a/button.ts b/button.ts\n+export const Button = () => {}'

    const result = await generateStagedMessage(diff, baseConfig)

    expect(result.message).toBe('feat(ui): add new button component')
    expect(generateText).toHaveBeenCalledTimes(1)
  })

  it('should handle different providers', async () => {
    const { generateText } = await import('ai')

    ;(generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({ message: 'chore: update config' }),
    })

    const anthropicConfig: Config = { provider: 'anthropic', model: 'claude-sonnet-4' }
    const commit = {
      hash: 'def456',
      shortHash: 'def456',
      message: 'update stuff',
      body: undefined,
    }

    const result = await generateCommitMessage(commit, anthropicConfig)

    expect(result.message).toBe('chore: update config')
  })

  it('should handle missing reasoning', async () => {
    const { generateText } = await import('ai')

    ;(generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({ message: 'docs: update readme' }),
    })

    const commit = {
      hash: 'ghi789',
      shortHash: 'ghi789',
      message: 'update docs',
      body: 'detailed explanation',
    }

    const result = await generateCommitMessage(commit, baseConfig)

    expect(result.message).toBe('docs: update readme')
    expect(result.reasoning).toBeUndefined()
  })

  it('should use default model when not specified', async () => {
    const { generateText } = await import('ai')

    ;(generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({ message: 'refactor: simplify code' }),
    })

    const commit = {
      hash: 'jkl012',
      shortHash: 'jkl012',
      message: 'refactor',
      body: undefined,
    }

    await generateCommitMessage(commit, { provider: 'openai' })

    // Verify generateText was called (provider uses default model)
    expect(generateText).toHaveBeenCalledTimes(1)
  })
})
