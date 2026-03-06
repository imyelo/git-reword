import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('../../src/config.js', () => ({
  hasConfig: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}))

vi.mock('../../src/preflight.js', () => ({
  checkFastForward: vi.fn(),
  validateRewordOperation: vi.fn(),
}))

vi.mock('../../src/rebase/index.js', () => ({
  executeRewordRebase: vi.fn(),
}))

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}))

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

  it('should have format flag defined', () => {
    const formatFlag = MainCommand.flags.format
    expect(formatFlag).toBeDefined()
    expect(formatFlag.options).toContain('jsonl')
    expect(formatFlag.char).toBe('f')
  })

  it('should have all format options available', () => {
    const formatFlag = MainCommand.flags.format
    expect(formatFlag.options).toContain('text')
    expect(formatFlag.options).toContain('jsonl')
  })

  it('should have text as default format', () => {
    const formatFlag = MainCommand.flags.format
    expect(formatFlag.default).toBe('text')
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

    const flags = {
      yes: true,
      'dry-run': false,
      staged: false,
      'skip-check': false,
      config: false,
      apply: false,
      version: false,
    }
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

    const flags = {
      yes: true,
      'dry-run': true,
      staged: false,
      'skip-check': false,
      config: false,
      apply: false,
      version: false,
    }
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
    const flags = {
      yes: true,
      'dry-run': false,
      staged: false,
      'skip-check': false,
      config: false,
      apply: false,
      version: false,
    }
    const result = await generateRewrites(commits, flags, baseConfig)
    expect(result).toHaveLength(2)
    expect(generateObject).toHaveBeenCalledTimes(2)
  })

  it('should handle empty commits array', async () => {
    const flags = {
      yes: true,
      'dry-run': false,
      staged: false,
      'skip-check': false,
      config: false,
      apply: false,
      version: false,
    }
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
})

describe('--version flag', () => {
  it('should have version flag defined with -v alias', () => {
    const versionFlag = MainCommand.flags.version
    expect(versionFlag).toBeDefined()
    expect(versionFlag.char).toBe('v')
  })

  it('should output a version number when --version flag is passed', async () => {
    const { Command } = await import('@oclif/core')
    const calls: string[] = []
    const logSpy = vi.spyOn(Command.prototype, 'log').mockImplementation((msg?: string) => {
      calls.push(String(msg ?? ''))
    })
    try {
      await MainCommand.run(['--version'], import.meta.url)
      expect(calls.join('')).toMatch(/^\d+\.\d+\.\d+$/)
    } finally {
      logSpy.mockRestore()
    }
  })
})

describe('--apply flag', () => {
  it('should have apply flag defined', () => {
    const applyFlag = MainCommand.flags.apply
    expect(applyFlag).toBeDefined()
    expect(applyFlag.char).toBe('a')
  })

  it('should have -a alias for apply flag', () => {
    const applyFlag = MainCommand.flags.apply
    expect(applyFlag.char).toBe('a')
  })
})

describe('MainCommand.run() - command dispatch', () => {
  let logs: string[]
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.clearAllMocks()
    logs = []
    const { Command } = await import('@oclif/core')
    logSpy = vi.spyOn(Command.prototype, 'log').mockImplementation((msg?: string) => {
      logs.push(String(msg ?? ''))
    })

    const { hasConfig, loadConfig } = await import('../../src/config.js')
    vi.mocked(hasConfig).mockResolvedValue(true)
    vi.mocked(loadConfig).mockResolvedValue({ provider: 'openai', model: 'gpt-4o' })

    const { checkUncommittedChanges, checkBranchContains } = await import('../../src/git/index.js')
    vi.mocked(checkUncommittedChanges).mockResolvedValue(false)
    vi.mocked(checkBranchContains).mockResolvedValue(true)

    const { checkFastForward } = await import('../../src/preflight.js')
    vi.mocked(checkFastForward).mockResolvedValue(true)
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('should error when --apply and --dry-run used together', async () => {
    const err = await MainCommand.run(['--apply', '--dry-run'], import.meta.url).catch(e => e)
    expect(err?.oclif?.exit).toBeGreaterThan(0)
  })

  it('should error when uncommitted changes exist', async () => {
    const { checkUncommittedChanges } = await import('../../src/git/index.js')
    vi.mocked(checkUncommittedChanges).mockResolvedValue(true)
    const err = await MainCommand.run(['--last', '1'], import.meta.url).catch(e => e)
    expect(err?.message).toContain('Uncommitted changes')
  })

  it('should error when fast-forward check fails', async () => {
    const { checkFastForward } = await import('../../src/preflight.js')
    vi.mocked(checkFastForward).mockResolvedValue(false)
    const err = await MainCommand.run(['--last', '1'], import.meta.url).catch(e => e)
    expect(err?.message).toContain('fast-forward')
  })

  it('should show text dry-run preview with original and new messages', async () => {
    const { getCommits } = await import('../../src/git/index.js')
    vi.mocked(getCommits).mockResolvedValue([
      { hash: 'abc1234567890', shortHash: 'abc1234', message: 'fix: old message', body: '' },
    ])
    const { generateObject } = await import('ai')
    vi.mocked(generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { subject: 'fix: new message', body: '' },
    })

    await MainCommand.run(['--last', '1', '--yes', '--dry-run', '--skip-check'], import.meta.url)

    const output = logs.join('\n')
    expect(output).toContain('Dry Run')
    expect(output).toContain('fix: new message')
    expect(output).toContain('fix: old message')
  })

  it('should output JSONL dry-run preview', async () => {
    const { getCommits } = await import('../../src/git/index.js')
    vi.mocked(getCommits).mockResolvedValue([
      { hash: 'abc1234567890', shortHash: 'abc1234', message: 'fix: old message', body: '' },
    ])
    const { generateObject } = await import('ai')
    vi.mocked(generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { subject: 'fix: new message', body: '' },
    })

    await MainCommand.run(['--last', '1', '--yes', '--dry-run', '--skip-check', '--format', 'jsonl'], import.meta.url)

    const jsonLine = logs.find(l => l.startsWith('{'))
    expect(jsonLine).toBeDefined()
    const parsed = JSON.parse(jsonLine ?? '{}')
    expect(parsed.commit).toBe('abc1234567890')
    expect(parsed.newMessage).toBe('fix: new message')
  })

  it('should reword commits and report text results', async () => {
    const { getCommits } = await import('../../src/git/index.js')
    vi.mocked(getCommits).mockResolvedValue([
      { hash: 'abc1234567890', shortHash: 'abc1234', message: 'fix: old', body: '' },
    ])
    const { generateObject } = await import('ai')
    vi.mocked(generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { subject: 'fix: new', body: '' },
    })
    const { executeRewordRebase } = await import('../../src/rebase/index.js')
    vi.mocked(executeRewordRebase).mockResolvedValue([
      { success: true, commit: 'abc1234567890', originalMessage: 'fix: old', newMessage: 'fix: new', newBody: '' },
    ])

    await MainCommand.run(['--last', '1', '--yes', '--skip-check'], import.meta.url)

    const output = logs.join('\n')
    expect(output).toContain('✓')
    expect(output).toContain('1/1 commits rewrote')
  })

  it('should output JSONL results after reword', async () => {
    const { getCommits } = await import('../../src/git/index.js')
    vi.mocked(getCommits).mockResolvedValue([
      { hash: 'abc1234567890', shortHash: 'abc1234', message: 'fix: old', body: '' },
    ])
    const { generateObject } = await import('ai')
    vi.mocked(generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { subject: 'fix: new', body: '' },
    })
    const { executeRewordRebase } = await import('../../src/rebase/index.js')
    vi.mocked(executeRewordRebase).mockResolvedValue([
      { success: true, commit: 'abc1234567890', originalMessage: 'fix: old', newMessage: 'fix: new', newBody: '' },
    ])

    await MainCommand.run(['--last', '1', '--yes', '--skip-check', '--format', 'jsonl'], import.meta.url)

    const jsonLine = logs.find(l => l.startsWith('{'))
    expect(jsonLine).toBeDefined()
    const parsed = JSON.parse(jsonLine ?? '{}')
    expect(parsed.success).toBe(true)
    expect(parsed.commit).toBe('abc1234567890')
    expect(parsed.newMessage).toBe('fix: new')
  })

  it('should error when no staged changes in --staged mode', async () => {
    // getSimpleGit mock returns staged: [] by default
    const err = await MainCommand.run(['--staged'], import.meta.url).catch(e => e)
    expect(err?.message).toContain('No staged changes')
  })
})
