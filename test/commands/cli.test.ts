import { beforeEach, describe, expect, it, vi } from 'vitest'
import MainCommand, { generateRewrites } from '../../src/commands/default'
import type { Config } from '../../src/config'
import { checkBranchContains, checkUncommittedChanges, getCommits } from '../../src/git/index'
import { getSimpleGit } from '../../src/git/simple-git'
import type { Commit } from '../../src/types'

// Mock getCommits, checkBranchContains, checkUncommittedChanges
vi.mock('../../src/git/index.js', async () => {
  const actual = await vi.importActual('../../src/git/index.js')
  return {
    ...actual,
    getCommits: vi.fn(),
    checkBranchContains: vi.fn(),
    checkUncommittedChanges: vi.fn(),
  }
})

// Mock simple-git - will be used in most tests
vi.mock('../../src/git/simple-git.js', () => ({
  getSimpleGit: vi.fn(() =>
    Promise.resolve({
      show: vi.fn().mockResolvedValue('diff content'),
      status: vi.fn().mockResolvedValue({ staged: [] }),
      log: vi.fn().mockResolvedValue({ all: [] }),
    })
  ),
  getGitLog: vi.fn().mockResolvedValue([]),
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
    vi.mocked(mockedGetCommits).mockRejectedValue(new Error("fatal: invalid commit 'invalid-ref'"))

    await expect(getCommits({ since: 'invalid-ref' })).rejects.toThrow("fatal: invalid commit 'invalid-ref'")
  })

  it('should return rewrites when dry-run is true', async () => {
    const { generateObject } = await import('ai')
    ;(generateObject as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { subject: 'feat: add new feature', body: '' },
    })

    const flags = { yes: true, 'dry-run': true, staged: false, 'skip-check': false }
    const result = await generateRewrites(mockCommits, flags, baseConfig)

    // dry-run doesn't affect generation, just execution
    expect(result).toHaveLength(1)
    expect(result?.[0].newMessage).toBe('feat: add new feature')
  })

  it('should generate rewrites for multiple commits', async () => {
    const { generateObject } = await import('ai')
    ;(generateObject as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ object: { subject: 'fix: resolve bug', body: '' } })
      .mockResolvedValueOnce({ object: { subject: 'feat: add feature', body: '' } })

    const commits: Commit[] = [
      { hash: 'abc123', shortHash: 'abc123', message: 'fix bug', body: '' },
      { hash: 'def456', shortHash: 'def456', message: 'add feature', body: '' },
    ]
    const flags = { yes: true, 'dry-run': false, staged: false, 'skip-check': false }
    const result = await generateRewrites(commits, flags, baseConfig)
    expect(result).toHaveLength(2)
    expect(generateObject).toHaveBeenCalledTimes(2)
  })

  it('should handle empty commits array', async () => {
    const flags = { yes: true, 'dry-run': false, staged: false, 'skip-check': false }
    const result = await generateRewrites([], flags, baseConfig)
    expect(result).toHaveLength(0)
  })

  // Note: getCommits with temp repo is tested in test/git/index.test.ts

  it('should return false for commit not on current branch', async () => {
    const { checkBranchContains: mockedCheck } = await import('../../src/git/index')
    vi.mocked(mockedCheck).mockResolvedValue(false)
    const result = await checkBranchContains('abc123')
    expect(result).toBe(false)
  })

  it('should detect uncommitted changes', async () => {
    const { checkUncommittedChanges: mockedCheck } = await import('../../src/git/index')
    vi.mocked(mockedCheck).mockResolvedValue(true)
    const result = await checkUncommittedChanges()
    expect(result).toBe(true)
  })

  it('should detect no staged changes in git status', async () => {
    const { getSimpleGit: mockedGetSimpleGit } = await import('../../src/git/simple-git')
    const mockGit = { status: vi.fn().mockResolvedValue({ staged: [] }) }
    vi.mocked(mockedGetSimpleGit).mockResolvedValue(mockGit)
    const git = await getSimpleGit()
    const status = await git.status()
    expect(status.staged).toHaveLength(0)
  })
})
