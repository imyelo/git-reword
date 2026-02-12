import { getGitLog, getSimpleGit } from '../git/simple-git.js'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export interface RewordResult {
  success: boolean
  commit: string
  originalMessage: string
  newMessage: string
  error?: string
}

export async function executeRewordRebase(
  commits: Array<{ hash: string; newMessage: string }>
): Promise<RewordResult[]> {
  const results: RewordResult[] = []

  if (commits.length === 0) {
    return results
  }

  const git = await getSimpleGit()
  const firstCommit = commits[0]
  if (!firstCommit) {
    return results
  }
  const base = `${firstCommit.hash}^`

  // Create a temporary directory for message files (secure, no /tmp symlink attacks)
  const tempDir = join(tmpdir(), `git-reword-${randomUUID()}`)
  mkdirSync(tempDir, { mode: 0o700 })

  try {
    // Get original messages before rebase
    for (const commit of commits) {
      const entries = await getGitLog(git, `${commit.hash}^..${commit.hash}`)
      const entry = entries[0]
      results.push({
        success: true,
        commit: commit.hash,
        originalMessage: entry?.body || entry?.subject || '',
        newMessage: commit.newMessage,
      })

      // Write each message to its own file (no shell interpolation possible)
      const msgFile = join(tempDir, `${commit.hash}.msg`)
      writeFileSync(msgFile, commit.newMessage, { mode: 0o600 })
    }

    // Build the rebase todo list
    // Each exec command reads the message from a file (no shell injection possible)
    const rebaseTodo = commits
      .map(c => `exec git commit --amend -F "${join(tempDir, `${c.hash}.msg`)}" --no-gpg-sign`)
      .join('\n')

    // Write the rebase script
    const scriptPath = join(tempDir, 'rebase.sh')
    writeFileSync(scriptPath, `#!/bin/bash\n${rebaseTodo}`, { mode: 0o600 })

    // Start interactive rebase with the script
    await git.raw([
      'rebase',
      '-i',
      '--keep-empty',
      '--no-autosquash',
      '--no-autostash',
      '--no-gpg-sign',
      '--root',
      '-x',
      `bash "${scriptPath}"`,
      base,
    ])
  } catch (error) {
    // Abort on any error
    await git.raw(['rebase', '--abort']).catch(() => {})

    return results.map(
      (r): RewordResult => ({
        ...r,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    )
  } finally {
    // Clean up temp directory
    try {
      rmdirSync(tempDir, { recursive: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  return results
}
