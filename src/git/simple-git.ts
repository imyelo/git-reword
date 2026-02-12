import type { SimpleGit } from 'simple-git'

// simple-git ESM wrapper - provides type-safe access to simple-git
// simple-git is CJS-first, so we need careful handling for ESM

let _gitInstance: SimpleGit | null = null

export async function getSimpleGit(): Promise<SimpleGit> {
  if (!_gitInstance) {
    // Use dynamic import for CJS module
    const mod = await import('simple-git')
    // Create instance - simple-git exports a factory function as default
    const factory = mod.default as unknown as (baseDir?: string) => SimpleGit
    _gitInstance = factory()
  }
  return _gitInstance
}

// Define our own log entry type with required fields
interface LogEntry {
  hash: string
  subject: string
  body: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLogEntryField(entry: any, field: string): string {
  return entry[field as keyof typeof entry] ?? ''
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
  const result = (await git.raw([
    'merge-base',
    '--is-ancestor',
    commit,
    'HEAD',
  ])) as unknown as GitRawResult
  return result.exitCode === 0
}
