import type { Commit, RewordOptions } from '../types.js'
import { getCommitRange, parseCommits } from './parser.js'
import { getSimpleGit, getGitLog } from './simple-git.js'

export async function getCommits(options: RewordOptions): Promise<Commit[]> {
  const range = getCommitRange(options)
  const git = await getSimpleGit()

  if (!range) {
    const entries = await getGitLog(git, '-1')
    return parseCommits(formatLogOutput(entries))
  }

  const entries = await getGitLog(git, `${range.from}..${range.to}`)
  return parseCommits(formatLogOutput(entries))
}

function formatLogOutput(entries: Array<{ hash: string; subject: string; body: string }>): string {
  return entries.map((e) => `${e.hash}\n${e.subject}\n${e.body}`).join('\n\n')
}

export async function checkUncommittedChanges(): Promise<boolean> {
  const git = await getSimpleGit()
  const status = await git.status()
  return status.files.length > 0
}

export async function checkBranchContains(commit: string): Promise<boolean> {
  const git = await getSimpleGit()
  const branches = await git.branch(['--contains', commit])
  const head = await git.revparse(['--abbrev-ref', 'HEAD'])
  return branches.all.includes(head)
}
