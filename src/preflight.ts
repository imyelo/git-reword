import simpleGit from 'simple-git'
import type { RewordOptions } from './types'

export interface PreflightResult {
  valid: boolean
  errors: string[]
}

export async function validateRewordOperation(options: RewordOptions): Promise<PreflightResult> {
  const errors: string[] = []

  // Check 1: No uncommitted changes
  const git = simpleGit()
  const status = await git.status()

  if (status.files.length > 0) {
    errors.push('Uncommitted changes detected. Please commit or stash them first.')
  }

  // Check 2: Fast-forward possible
  if (!(await checkFastForward(options))) {
    errors.push('Cannot fast-forward to target commits. They may have been rebased or amended.')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export async function checkFastForward(options: RewordOptions): Promise<boolean> {
  const git = simpleGit()

  if (options.last) {
    const base = `HEAD~${options.last}`
    const isAncestor = await git.raw(['merge-base', '--is-ancestor', base, 'HEAD'])
    return isAncestor.exitCode === 0
  }

  if (options.since) {
    const isAncestor = await git.raw(['merge-base', '--is-ancestor', options.since, 'HEAD'])
    return isAncestor.exitCode === 0
  }

  if (options.range) {
    const [from] = options.range.split('..')
    const isAncestor = await git.raw(['merge-base', '--is-ancestor', from, 'HEAD'])
    return isAncestor.exitCode === 0
  }

  if (options.commit) {
    const isAncestor = await git.raw(['merge-base', '--is-ancestor', options.commit, 'HEAD'])
    return isAncestor.exitCode === 0
  }

  // Default: just HEAD
  return true
}
