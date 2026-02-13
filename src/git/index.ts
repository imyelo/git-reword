import type { Commit, RewordOptions } from '../types.js'
import { getCommitRange } from './parser.js'
import { getGitLog, getSimpleGit } from './simple-git.js'

export async function getCommits(options: RewordOptions, cwd?: string): Promise<Commit[]> {
  const range = getCommitRange(options)
  const git = await getSimpleGit(cwd)

  const rangeStr = range ? `${range.from}..${range.to}` : '-1'
  const entries = await getGitLog(git, rangeStr)

  return entries.map(e => ({
    hash: e.hash,
    shortHash: e.hash.substring(0, 7),
    message: e.subject,
    body: e.body,
  }))
}

export async function checkUncommittedChanges(cwd?: string): Promise<boolean> {
  const git = await getSimpleGit(cwd)
  const status = await git.status()
  return status.files.length > 0
}

export async function checkBranchContains(commit: string, cwd?: string): Promise<boolean> {
  const git = await getSimpleGit(cwd)
  try {
    const branches = await git.branch(['--contains', commit])
    const head = await git.revparse(['--abbrev-ref', 'HEAD'])
    return branches.all.includes(head)
  } catch {
    // Commit doesn't exist in this repository
    return false
  }
}
