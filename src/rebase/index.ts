import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import type { SimpleGit } from 'simple-git'
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

  // Check if first commit is a root commit (no parent)
  const isRootCommit = await isRoot(git, firstCommit.hash)
  const base = isRootCommit ? undefined : `${firstCommit.hash}^`

  // Build a map from original subject to new message file
  const subjectToMsgFile: Map<string, string> = new Map()

  const tempDir = join(tmpdir(), `git-reword-${randomUUID()}`)
  mkdirSync(tempDir, { mode: 0o700 })

  try {
    for (const commit of commits) {
      const subject = (await git.raw(['log', '-1', '--format=%s', commit.hash])).trim()
      const body = (await git.raw(['log', '-1', '--format=%b', commit.hash])).trim()

      const originalSubject = subject
      const fullMessage = composeCommitMessage(commit.newMessage, commit.newBody)
      results.push({
        success: true,
        commit: commit.hash,
        originalMessage: body || subject,
        newMessage: fullMessage,
        newBody: commit.newBody,
      })

      const msgFile = join(tempDir, `${commit.hash}.msg`)
      writeFileSync(msgFile, fullMessage, { mode: 0o600 })

      // Map original subject to message file for matching during rebase
      subjectToMsgFile.set(originalSubject, msgFile)
    }

    // Generate a script that checks if current HEAD's subject matches one of the commits to reword
    // Use subject instead of hash because commit hashes change after rebase
    // Use ||| as delimiter since it's unlikely to appear in commit subjects
    const msgFilesList = Array.from(subjectToMsgFile.entries())
      .map(([subject, msgFile]) => `"${subject}|||${msgFile}"`)
      .join(' ')

    const scriptContent = `#!/bin/bash
CURRENT_SUBJECT=$(git log -1 --format=%s)
for item in ${msgFilesList}; do
  subject=\${item%%|||*}
  msgfile=\${item##*|||}
  if [ "$CURRENT_SUBJECT" = "$subject" ]; then
    exec git commit --amend -F "$msgfile" --no-verify
  fi
done
`
    const scriptPath = join(tempDir, 'rebase.sh')
    writeFileSync(scriptPath, scriptContent, { mode: 0o600 })

    // Build rebase command
    const rebaseArgs: string[] = ['rebase', '-i', '--keep-empty', '--no-autosquash', '--no-autostash', '--no-verify']

    // Only use --root if first commit is root commit
    if (isRootCommit) {
      rebaseArgs.push('--root')
    }

    // Use -x to execute the script after each commit
    rebaseArgs.push('-x', `bash "${scriptPath}"`)

    rebaseArgs.push(base || 'HEAD')

    // Set GIT_EDITOR to a non-interactive command to prevent git from trying to open an editor
    // This is required for git rebase -i to work in non-interactive environments
    const originalEditor = env.GIT_EDITOR
    env.GIT_EDITOR = 'true'

    try {
      await git.raw(rebaseArgs)
    } finally {
      // Restore original editor setting
      if (originalEditor !== undefined) {
        env.GIT_EDITOR = originalEditor
      } else {
        delete env.GIT_EDITOR
      }
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

// Check if a commit is a root commit (has no parent)
async function isRoot(git: SimpleGit, hash: string): Promise<boolean> {
  try {
    await git.raw(['rev-parse', `${hash}^`])
    return false // Has parent, not root
  } catch {
    return true // No parent, is root
  }
}

function composeCommitMessage(subject: string, body: string): string {
  if (!body || body.trim() === '') {
    return subject
  }
  return `${subject}\n\n${body}`
}
