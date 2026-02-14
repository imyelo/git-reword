import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getGitLog, getSimpleGit } from '../git/simple-git.js'

export interface RewordResult {
  success: boolean
  commit: string
  originalMessage: string
  newMessage: string
  newBody: string
  error?: string
}

export async function executeRewordRebase(
  commits: Array<{ hash: string; newMessage: string; newBody: string }>,
  cwd?: string
): Promise<RewordResult[]> {
  const results: RewordResult[] = []

  if (commits.length === 0) {
    return results
  }

  const git = await getSimpleGit(cwd)
  const firstCommit = commits[0]
  if (!firstCommit) {
    return results
  }

  try {
    // Get the parent of the first commit to reword
    const firstHash = firstCommit.hash
    const base = `${firstHash}^`

    // Get all commits in the range (base..HEAD)
    const allCommitsInRange = await getGitLog(git, `${base}..HEAD`)
    // Reverse to process from oldest to newest
    const commitList = allCommitsInRange.map(c => c.hash).reverse()

    // Build a map of commits to reword
    const rewordMap = new Map(commits.map(c => [c.hash, c]))

    // Note: We don't need to store the branch name as commit-tree creates detached commits

    // Process each commit - use git commit-tree to create new commits
    // This is more reliable than rebase
    let parentHash = base
    const newCommitHashes: string[] = []

    for (const hash of commitList) {
      // Get commit subject and body separately
      const subject = (await git.raw(['log', '-1', '--format=%s', hash])).trim()
      const body = (await git.raw(['log', '-1', '--format=%b', hash])).trim()

      let newSubject = subject
      let newBody = body

      // Check if this commit should be rewording
      const rewordCommit = rewordMap.get(hash)
      if (rewordCommit) {
        newSubject = rewordCommit.newMessage
        newBody = rewordCommit.newBody

        results.push({
          success: true,
          commit: hash,
          originalMessage: body || subject,
          newMessage: composeCommitMessage(newSubject, newBody),
          newBody: newBody,
        })
      } else {
        results.push({
          success: true,
          commit: hash,
          originalMessage: body || subject,
          newMessage: composeCommitMessage(subject, body),
          newBody: body,
        })
      }

      // Get tree hash
      const treeHash = (await git.raw(['rev-parse', `${hash}^{tree}`])).trim()

      // Get author info
      // Get author info (for preserving original author)
      const authorInfo = (await git.raw(['log', '-1', '--format=%an <%ae>', hash])).trim()
      const [authorName, authorEmail] = authorInfo.split(' ')

      // Build new commit message
      const newMessage = composeCommitMessage(newSubject, newBody)

      // Create new commit with git commit-tree
      // Author info must be passed via environment variable
      const newHash = (
        await git.raw([
          '-c',
          `user.name=${authorName}`,
          '-c',
          `user.email=${authorEmail}`,
          'commit-tree',
          treeHash,
          '-p',
          parentHash,
          '-m',
          newMessage,
        ])
      ).trim()

      newCommitHashes.push(newHash)
      parentHash = newHash
    }

    // Update branch to point to new commits
    if (newCommitHashes.length > 0) {
      const newHead = newCommitHashes[newCommitHashes.length - 1]
      await git.reset(['--hard', newHead])
    }
  } catch (error) {
    return results.map(
      (r): RewordResult => ({
        ...r,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    )
  }

  return results
}

function composeCommitMessage(subject: string, body: string): string {
  if (!body || body.trim() === '') {
    return subject
  }
  return `${subject}\n\n${body}`
}
