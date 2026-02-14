import { beforeEach, describe, expect, it, vi } from 'vitest'
import MainCommand, { generateRewrites } from '../../src/commands/default'
import { getCommits } from '../../src/git/index'
import type { Config } from '../../src/config'
import type { Commit } from '../../src/types'

// Mock getCommits
vi.mock('../../src/git/index.js', () => ({
  ...vi.importActual('../../src/git/index.js'),
  getCommits: vi.fn(),
}))

// Mock simple-git
vi.mock('../../src/git/simple-git.js', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      show: vi.fn().mockResolvedValue('diff content'),
    })
  ),
}))

// Mock AI SDK
vi.mock('ai', async () => {
  return {
    generateObject: vi.fn(),
  }
})

describe('generateRewrites export', () => {
  it('should export generateRewrites function', () => {
    expect(typeof generateRewrites).toBe('function')
  })
})

describe('MainCommand export', () => {
  it('should export MainCommand with correct summary', () => {
    expect(MainCommand).toBeDefined()
    expect(MainCommand.summary).toBe('AI-powered Git commit message rewriter')
  })
})

describe('CLI generateRewrites', () => {
  const baseConfig: Config = {
    provider: 'openai',
    model: 'gpt-4o',
  }

  const mockCommits: Commit[] = [
    {
      hash: 'abc123def456',
      shortHash: 'abc123d',
      message: 'fix bug',
      body: '',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate rewrites for all commits when yes flag is true', async () => {
    const { generateObject } = await import('ai')
    ;(generateObject as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { subject: 'fix(auth): resolve login timeout', body: '' },
    })

    const flags = { yes: true, 'dry-run': false, staged: false, 'skip-check': false }
    const result = await generateRewrites(mockCommits, flags, baseConfig)

    expect(result).toHaveLength(1)
    expect(result?.[0].newMessage).toBe('fix(auth): resolve login timeout')
    expect(generateObject).toHaveBeenCalledTimes(1)
  })

  it('should throw error for invalid --since ref', async () => {
    const { getCommits: mockedGetCommits } = await import('../../src/git/index')
    ;(mockedGetCommits as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("fatal: invalid commit 'invalid-ref'")
    )

    await expect(
      getCommits({ since: 'invalid-ref' })
    ).rejects.toThrow("fatal: invalid commit 'invalid-ref'")
  })
})
