import { exec as execSync } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { executeRewordRebase } from '../../src/rebase'
import { cleanupTempRepo, createTempGitRepo } from '../helpers/git'

const execAsync = promisify(execSync)

describe('rebase with --last flag', () => {
  // Test: --last 3 with 6 commits should correctly reword the last 3 commits
  it('should reword last 3 commits when repo has 6 commits and user runs --last 3', async () => {
    const tempDir = await createTempGitRepo()
    try {
      // Create exactly 6 commits: initial -> 1 -> 2 -> 3 -> 4 -> 5 -> 6
      const messages = ['feat: 1', 'feat: 2', 'feat: 3', 'feat: 4', 'feat: 5', 'feat: 6']
      for (const msg of messages) {
        await execAsync(`echo "${msg}" > ${msg.split(':')[1].trim()}.txt && git add *.txt && git commit -m "${msg}"`, {
          cwd: tempDir,
        })
      }

      // User runs --last 3, which gets commits: HEAD(6), HEAD~1(5), HEAD~2(4)
      // Expected: reword commits 4, 5, 6
      // But with the bug: base = HEAD^ = HEAD~1(5), rebase rebases HEAD~1, HEAD~2, HEAD~3...
      // This rebases commits: 5, 4, 3, 2 (not 6!)

      // Get hashes
      const hash6 = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim() // 6
      const hash5 = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim() // 5
      const hash4 = (await execAsync('git rev-parse HEAD~2', { cwd: tempDir })).stdout.trim() // 4

      // Reword the last 3 commits (4, 5, 6)
      const results = await executeRewordRebase(
        [
          { hash: hash4, newMessage: 'feat: four-new', newBody: '' },
          { hash: hash5, newMessage: 'feat: five-new', newBody: '' },
          { hash: hash6, newMessage: 'feat: six-new', newBody: '' },
        ],
        tempDir
      )

      // Verify all rewrites succeeded
      expect(results).toHaveLength(3)

      // Verify all 3 commits are reworded
      const msg6 = (await execAsync('git log -1 --format=%s HEAD', { cwd: tempDir })).stdout.trim()
      expect(msg6).toBe('feat: six-new')

      const msg5 = (await execAsync('git log -1 --format=%s HEAD~1', { cwd: tempDir })).stdout.trim()
      expect(msg5).toBe('feat: five-new')

      const msg4 = (await execAsync('git log -1 --format=%s HEAD~2', { cwd: tempDir })).stdout.trim()
      expect(msg4).toBe('feat: four-new')

      // Verify earlier commits unchanged
      const msg3 = (await execAsync('git log -1 --format=%s HEAD~3', { cwd: tempDir })).stdout.trim()
      expect(msg3).toBe('feat: 3')

      const msg2 = (await execAsync('git log -1 --format=%s HEAD~4', { cwd: tempDir })).stdout.trim()
      expect(msg2).toBe('feat: 2')

      const msg1 = (await execAsync('git log -1 --format=%s HEAD~5', { cwd: tempDir })).stdout.trim()
      expect(msg1).toBe('feat: 1')
    } finally {
      await cleanupTempRepo(tempDir)
    }
  })
})
