import type { RewordOptions } from './types.js'
import { getSimpleGit, checkMergeBase } from './git/simple-git.js'

export interface PreflightResult {
  valid: boolean
  errors: string[]
}

export async function validateRewordOperation(options: RewordOptions): Promise<PreflightResult> {
  const errors: string[] = []
  const git = await getSimpleGit()

  // Check 1: No uncommitted changes
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
  const git = await getSimpleGit()

  if (options.last) {
    const base = `HEAD~${options.last}`
    return await checkMergeBase(git, base)
  }

  if (options.since) {
    return await checkMergeBase(git, options.since)
  }

  if (options.range) {
    const [from] = options.range.split('..')
    return await checkMergeBase(git, from)
  }

  if (options.commit) {
    return await checkMergeBase(git, options.commit)
  }

  // Default: just HEAD
  return true
}
