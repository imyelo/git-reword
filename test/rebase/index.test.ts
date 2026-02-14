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
  })
})
