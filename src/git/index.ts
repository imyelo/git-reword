import simpleGit from 'simple-git'
import type { Commit, RewordOptions } from '../types'
import { getCommitRange, parseCommits } from './parser'

export async function getCommits(options: RewordOptions): Promise<Commit[]> {
  const range = getCommitRange(options)
  if (!range) {
    const log = await simpleGit().log(['-1'])
    return parseCommits(formatLogOutput(log))
  }

  const log = await simpleGit().log([`${range.from}..${range.to}`])
  return parseCommits(formatLogOutput(log))
}

function formatLogOutput(log: { all: Array<{ hash: string; message: string; body: string }> }): string {
  return log.all.map(c => `${c.hash}\n${c.message}\n${c.body}`).join('\n\n')
}

export async function checkUncommittedChanges(): Promise<boolean> {
  const status = await simpleGit().status()
  return status.files.length > 0
}

export async function checkBranchContains(commit: string): Promise<boolean> {
  const git = simpleGit()
  const branches = await git.branch(['--contains', commit])
  return branches.all.includes(git.getHead())
}
