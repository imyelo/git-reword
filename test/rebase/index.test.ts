import { describe, expect, it } from 'vitest'
import { executeRewordRebase, type RewordResult } from '../../src/rebase'
import { cleanupTempRepo, createTempGitRepo } from '../helpers/git'

describe('rebase executor', () => {
  it('should export executeRewordRebase function', async () => {
    const { executeRewordRebase } = await import('../../src/rebase')
    expect(typeof executeRewordRebase).toBe('function')
  })

  it('should return empty array for empty commits', async () => {
    const { executeRewordRebase } = await import('../../src/rebase')
    const results = await executeRewordRebase([])
    expect(results).toEqual([])
  })

  describe('with temp git repo', () => {
    it('should reword a single commit message', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create a commit to reword
        await execAsync('echo "content" > file.txt && git add file.txt && git commit -m "fix bug"', {
          cwd: tempDir,
        })
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Reword the commit
        const results = await executeRewordRebase(
          [{ hash, newMessage: 'fix(auth): resolve login timeout', newBody: '' }],
          tempDir
        )

        expect(results).toHaveLength(1)
        expect(results[0]?.success).toBe(true)
        expect(results[0]?.originalMessage).toBe('fix bug')

        // Verify the commit message was actually changed
        const newMessage = (await execAsync('git log -1 --format=%s', { cwd: tempDir })).stdout.trim()
        expect(newMessage).toBe('fix(auth): resolve login timeout')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should return results for multiple commits', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create 2 additional commits
        await execAsync('echo "content1" > file1.txt && git add file1.txt && git commit -m "fix one"', {
          cwd: tempDir,
        })
        await execAsync('echo "content2" > file2.txt && git add file2.txt && git commit -m "fix two"', {
          cwd: tempDir,
        })

        // Get hashes
        const hash1 = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim()
        const hash2 = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Reword both commits
        const results = await executeRewordRebase(
          [
            { hash: hash1, newMessage: 'fix(auth): resolve first issue', newBody: '' },
            { hash: hash2, newMessage: 'fix(api): resolve second issue', newBody: '' },
          ],
          tempDir
        )

        // Should return results for both commits
        expect(results).toHaveLength(2)
        expect(results.every(r => r.success)).toBe(true)
        expect(results[0]?.originalMessage).toBe('fix one')
        expect(results[1]?.originalMessage).toBe('fix two')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should reword commit with subject and body', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create a commit with body
        await execAsync(
          'echo "content" > file.txt && git add file.txt && git commit -m "fix bug" -m "This is the body"',
          { cwd: tempDir }
        )
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Reword with new subject and body
        const results = await executeRewordRebase(
          [
            {
              hash,
              newMessage: 'fix(auth): resolve login timeout',
              newBody: 'The login was timing out after 30 seconds.\n\nAdded longer timeout.',
            },
          ],
          tempDir
        )

        expect(results[0]?.success).toBe(true)

        // Verify subject
        const subject = (await execAsync('git log -1 --format=%s', { cwd: tempDir })).stdout.trim()
        expect(subject).toBe('fix(auth): resolve login timeout')

        // Verify body
        const body = (await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()
        expect(body).toContain('The login was timing out after 30 seconds.')
        expect(body).toContain('Added longer timeout.')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should handle special characters in commit message', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create a commit
        await execAsync('echo "content" > file.txt && git add file.txt && git commit -m "wip"', {
          cwd: tempDir,
        })
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Reword with special characters
        const results = await executeRewordRebase(
          [
            {
              hash,
              newMessage: 'feat: add support for "quotes" and `backticks`',
              newBody: 'Lines with:\n- emojis 🎉\n- unicode: 你好\n- symbols: @#$%',
            },
          ],
          tempDir
        )

        expect(results[0]?.success).toBe(true)

        // Verify
        const fullMessage = (await execAsync('git log -1 --format=%B', { cwd: tempDir })).stdout.trim()
        expect(fullMessage).toContain('feat: add support for "quotes" and `backticks`')
        expect(fullMessage).toContain('- emojis 🎉')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should handle commit with only body (empty subject)', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create a commit
        await execAsync('echo "content" > file.txt && git add file.txt && git commit -m "wip"', {
          cwd: tempDir,
        })
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Reword with only body - subject should still be used
        const results = await executeRewordRebase(
          [{ hash, newMessage: 'refactor: cleanup code', newBody: '' }],
          tempDir
        )

        expect(results[0]?.success).toBe(true)

        const message = (await execAsync('git log -1 --format=%s', { cwd: tempDir })).stdout.trim()
        expect(message).toBe('refactor: cleanup code')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should fail gracefully when rewording the root commit', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // The initial commit created by createTempGitRepo is the root commit
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Reword the root commit — `hash^` does not exist, should result in an error
        const results = await executeRewordRebase([{ hash, newMessage: 'reworded root', newBody: '' }], tempDir)

        // Should handle gracefully (error result or empty array)
        if (results.length > 0) {
          expect(results[0]?.success).toBe(false)
          expect(results[0]?.error).toBeDefined()
        }
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should only reword specified commits and leave others unchanged', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create 3 commits
        await execAsync('echo "a" > a.txt && git add a.txt && git commit -m "commit A"', {
          cwd: tempDir,
        })
        await execAsync('echo "b" > b.txt && git add b.txt && git commit -m "commit B"', {
          cwd: tempDir,
        })
        await execAsync('echo "c" > c.txt && git add c.txt && git commit -m "commit C"', {
          cwd: tempDir,
        })

        // Only reword the middle commit (B)
        const hashB = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim()

        const results = await executeRewordRebase(
          [{ hash: hashB, newMessage: 'feat: reworded B', newBody: '' }],
          tempDir
        )

        expect(results.length).toBeGreaterThanOrEqual(1)

        // Verify: commit C (HEAD) should still have original message
        const msgC = (await execAsync('git log -1 --format=%s HEAD', { cwd: tempDir })).stdout.trim()
        expect(msgC).toBe('commit C')

        // Verify: commit B should have new message
        const msgB = (await execAsync('git log -1 --format=%s HEAD~1', { cwd: tempDir })).stdout.trim()
        expect(msgB).toBe('feat: reworded B')

        // Verify: commit A should still have original message
        const msgA = (await execAsync('git log -1 --format=%s HEAD~2', { cwd: tempDir })).stdout.trim()
        expect(msgA).toBe('commit A')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should fail gracefully for non-existent commit hash', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const results = await executeRewordRebase(
          [{ hash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', newMessage: 'nope', newBody: '' }],
          tempDir
        )

        // Should return error result
        if (results.length > 0) {
          expect(results[0]?.success).toBe(false)
          expect(results[0]?.error).toBeDefined()
        }
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should verify all commit messages in git history after multi-reword', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create 2 commits
        await execAsync('echo "x" > x.txt && git add x.txt && git commit -m "old X"', {
          cwd: tempDir,
        })
        await execAsync('echo "y" > y.txt && git add y.txt && git commit -m "old Y"', {
          cwd: tempDir,
        })

        const hash1 = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim()
        const hash2 = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        await executeRewordRebase(
          [
            { hash: hash1, newMessage: 'feat(x): new X', newBody: '' },
            { hash: hash2, newMessage: 'feat(y): new Y', newBody: '' },
          ],
          tempDir
        )

        // Verify both messages in git history
        const msgHead = (await execAsync('git log -1 --format=%s HEAD', { cwd: tempDir })).stdout.trim()
        expect(msgHead).toBe('feat(y): new Y')

        const msgParent = (await execAsync('git log -1 --format=%s HEAD~1', { cwd: tempDir })).stdout.trim()
        expect(msgParent).toBe('feat(x): new X')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should preserve commit order after reword', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create 3 commits with distinct file content
        await execAsync('echo "1" > f1.txt && git add f1.txt && git commit -m "first"', {
          cwd: tempDir,
        })
        await execAsync('echo "2" > f2.txt && git add f2.txt && git commit -m "second"', {
          cwd: tempDir,
        })
        await execAsync('echo "3" > f3.txt && git add f3.txt && git commit -m "third"', {
          cwd: tempDir,
        })

        const hash1 = (await execAsync('git rev-parse HEAD~2', { cwd: tempDir })).stdout.trim()
        const hash3 = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Reword first and third commits
        await executeRewordRebase(
          [
            { hash: hash1, newMessage: 'reworded first', newBody: '' },
            { hash: hash3, newMessage: 'reworded third', newBody: '' },
          ],
          tempDir
        )

        // Verify order: HEAD is third, HEAD~1 is second (unchanged), HEAD~2 is first
        const log = (await execAsync('git log --format=%s --reverse', { cwd: tempDir })).stdout.trim().split('\n')

        // log includes initial commit + 3 commits
        const commitMessages = log.slice(-3)
        expect(commitMessages).toEqual(['reworded first', 'second', 'reworded third'])
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should preserve author info after reword', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create a commit (author is "Test User <test@example.com>" from helper)
        await execAsync('echo "content" > file.txt && git add file.txt && git commit -m "original"', {
          cwd: tempDir,
        })
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Get original author info
        const originalAuthor = (await execAsync('git log -1 --format=%an', { cwd: tempDir })).stdout.trim()
        const originalEmail = (await execAsync('git log -1 --format=%ae', { cwd: tempDir })).stdout.trim()

        // Reword the commit
        await executeRewordRebase([{ hash, newMessage: 'reworded message', newBody: '' }], tempDir)

        // Verify author info preserved
        const newAuthor = (await execAsync('git log -1 --format=%an', { cwd: tempDir })).stdout.trim()
        const newEmail = (await execAsync('git log -1 --format=%ae', { cwd: tempDir })).stdout.trim()

        expect(newAuthor).toBe(originalAuthor)
        expect(newEmail).toBe(originalEmail)
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should remove existing body when newBody is empty', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create a commit with body
        await execAsync(
          'echo "content" > file.txt && git add file.txt && git commit -m "fix bug" -m "This body should be removed"',
          { cwd: tempDir }
        )
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Verify body exists before reword
        const bodyBefore = (await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()
        expect(bodyBefore).toBe('This body should be removed')

        // Reword with empty body
        const results = await executeRewordRebase(
          [{ hash, newMessage: 'fix(core): resolved bug', newBody: '' }],
          tempDir
        )

        expect(results[0]?.success).toBe(true)

        // Verify body is removed
        const bodyAfter = (await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()
        expect(bodyAfter).toBe('')

        // Verify subject is correct
        const subject = (await execAsync('git log -1 --format=%s', { cwd: tempDir })).stdout.trim()
        expect(subject).toBe('fix(core): resolved bug')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should add body to a commit that originally had none', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create a commit without body
        await execAsync('echo "content" > file.txt && git add file.txt && git commit -m "fix bug"', {
          cwd: tempDir,
        })
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        // Verify no body before reword
        const bodyBefore = (await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()
        expect(bodyBefore).toBe('')

        // Reword: keep same subject but add body
        const results = await executeRewordRebase(
          [{ hash, newMessage: 'fix bug', newBody: 'Added detailed explanation of the fix.' }],
          tempDir
        )

        expect(results[0]?.success).toBe(true)

        // Verify body was added
        const bodyAfter = (await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()
        expect(bodyAfter).toBe('Added detailed explanation of the fix.')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should preserve multiline body with multiple paragraphs', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)

        // Create a commit
        await execAsync('echo "content" > file.txt && git add file.txt && git commit -m "wip"', {
          cwd: tempDir,
        })
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        const multilineBody = [
          'First paragraph describing the change.',
          '',
          'Second paragraph with more details.',
          '',
          'Third paragraph:',
          '- bullet point 1',
          '- bullet point 2',
        ].join('\n')

        const results = await executeRewordRebase(
          [{ hash, newMessage: 'feat: complex change', newBody: multilineBody }],
          tempDir
        )

        expect(results[0]?.success).toBe(true)

        const body = (await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()
        expect(body).toContain('First paragraph describing the change.')
        expect(body).toContain('Second paragraph with more details.')
        expect(body).toContain('- bullet point 1')
        expect(body).toContain('- bullet point 2')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })
  })

  describe('error handling', () => {
    it('should return error result for non-git-repo directory', async () => {
      const { mkdtemp } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const { rm } = await import('node:fs/promises')

      const tempDir = await mkdtemp(join(tmpdir(), 'not-a-git-repo-'))
      try {
        const results = await executeRewordRebase([{ hash: 'abc123', newMessage: 'test', newBody: '' }], tempDir)

        // Should return error result since it's not a git repo
        if (results.length > 0) {
          expect(results[0]?.success).toBe(false)
          expect(results[0]?.error).toBeDefined()
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })
})
