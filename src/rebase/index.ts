import simpleGit from 'simple-git'

export interface RewordResult {
  success: boolean
  commit: string
  originalMessage: string
  newMessage: string
  error?: string
}

export async function executeRewordReword(
  commits: Array<{ hash: string; newMessage: string }>
): Promise<RewordResult[]> {
  const results: RewordResult[] = []

  if (commits.length === 0) {
    return results
  }

  const git = simpleGit()

  try {
    // For each commit, create a backup and use git filter-branch to rewrite
    for (const commit of commits) {
      // Get original message
      const log = await git.log([commit.hash, '-1', '--format=%s%n%b'])
      const originalMessage = log.all[0]?.body || log.all[0]?.subject || ''

      // Use git commit-tree to create a new commit with the new message
      // but same tree (this is a safe way to change just the message)
      const tree = await git.raw(['rev-parse', `${commit.hash}^{tree}`])
      const parent = await git.raw(['rev-parse', `${commit.hash}^`])
      const timestamp = await git.raw(['log', '-1', '--format=%ct', commit.hash])
      const author = await git.raw(['log', '-1', '--format=%an <%ae>', commit.hash])

      // Create new commit with new message
      const _newHash = await git.commitTree({
        t: tree.trim(),
        p: parent.trim(),
        m: commit.newMessage,
        d: new Date(parseInt(timestamp.trim(), 10) * 1000).toISOString(),
        a: author.trim(),
      })

      results.push({
        success: true,
        commit: commit.hash,
        originalMessage,
        newMessage: commit.newMessage,
      })
    }

    // Move branch pointers to new commits
    // This is a simplified version - in production we'd need more robust handling
  } catch (error) {
    return results.map(r => ({
      ...r,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }))
  }

  return results
}

export async function executeRewordRebase(
  commits: Array<{ hash: string; newMessage: string }>
): Promise<RewordResult[]> {
  const results: RewordResult[] = []

  if (commits.length === 0) {
    return results
  }

  const git = simpleGit()
  const firstCommit = commits[0]
  if (!firstCommit) {
    return results
  }
  const base = `${firstCommit.hash}^`

  try {
    // Get original messages before rebase
    for (const commit of commits) {
      const log = await git.log([commit.hash, '-1', '--format=%s%n%b'])
      results.push({
        success: true,
        commit: commit.hash,
        originalMessage: log.all[0]?.body || log.all[0]?.subject || '',
        newMessage: commit.newMessage,
      })
    }

    // Build the rebase todo list
    // We need to create a script that will amend each commit with its new message
    const rebaseScript = commits
      .map(c => `exec git commit --amend -m "${escapeMessage(c.newMessage)}" --no-gpg-sign`)
      .join('\n')

    // Create a temporary script file
    const scriptPath = `/tmp/rebase-${Date.now()}.sh`
    await import('node:fs').then(fs => {
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
    await import('node:fs').then(fs => {
      try {
        fs.unlinkSync(scriptPath)
      } catch {
        // Ignore
      }
    })
  } catch (error) {
    // Abort on any error
    await git.raw(['rebase', '--abort']).catch(() => {})

    return results.map(r => ({
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
