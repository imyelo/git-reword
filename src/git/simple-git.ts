import type { SimpleGit } from 'simple-git'

// simple-git ESM wrapper - provides type-safe access to simple-git
// simple-git is CJS-first, so we need careful handling for ESM

let _cachedGit: SimpleGit | null = null
const _cachedCwd: string | null = null

export async function getSimpleGit(cwd?: string): Promise<SimpleGit> {
  // Always create a new instance when cwd is explicitly provided
  if (cwd) {
    const mod = await import('simple-git')
    const factory = mod.default as unknown as (baseDir?: string) => SimpleGit
    return factory(cwd)
  }
  // Use cached instance for cwd-less calls
  if (!_cachedGit) {
    const mod = await import('simple-git')
    const factory = mod.default as unknown as (baseDir?: string) => SimpleGit
    _cachedGit = factory()
  }
  return _cachedGit
}

// Define our own log entry type with required fields
interface LogEntry {
  hash: string
  subject: string
  body: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLogEntryField(entry: Record<string, unknown>, field: string): string {
  const value = entry[field]
  if (typeof value === 'string') {
    return value
  }
  // simple-git uses 'message' instead of 'subject'
  if (field === 'subject' && typeof entry.message === 'string') {
    return entry.message
  }
  return ''
}

export async function getGitLog(git: SimpleGit, range: string): Promise<LogEntry[]> {
  const result = await git.log([range])
  return result.all.map(
    (entry): LogEntry => ({
      hash: entry.hash,
      subject: getLogEntryField(entry, 'subject'),
      body: getLogEntryField(entry, 'body'),
    })
  )
}

// GitRawResult with exitCode - the actual return type varies by command
interface GitRawResult {
  exitCode: number
}

export async function checkMergeBase(git: SimpleGit, commit: string): Promise<boolean> {
  const result = (await git.raw(['merge-base', '--is-ancestor', commit, 'HEAD'])) as unknown as GitRawResult
  return result.exitCode === 0
}
