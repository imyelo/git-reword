import { getSimpleGit, getGitLog } from '../git/simple-git.js'

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
    }

    // Build the rebase todo list
    // We need to create a script that will amend each commit with its new message
    const rebaseScript = commits
      .map((c) => `exec git commit --amend -m "${escapeMessage(c.newMessage)}" --no-gpg-sign`)
      .join('\n')

    // Create a temporary script file
    const scriptPath = `/tmp/rebase-${Date.now()}.sh`
    await import('node:fs').then((fs) => {
      fs.writeFileSync(scriptPath, `#!/bin/bash\n${rebaseScript}`)
    })

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
      `bash ${scriptPath}`,
      base,
    ])

    // Clean up
    await import('node:fs').then((fs) => {
      try {
        fs.unlinkSync(scriptPath)
      } catch {
        // Ignore
      }
    })
  } catch (error) {
    // Abort on any error
    await git.raw(['rebase', '--abort']).catch(() => {})

    return results.map((r): RewordResult => ({
      ...r,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }))
  }

  return results
}

function escapeMessage(msg: string): string {
  return msg.replace(/"/g, '\\"').replace(/\n/g, '\\n')
}
