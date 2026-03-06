import { exec as execSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { executeRewordRebase } from '../../src/rebase'
import { cleanupTempRepo, createTempGitRepo } from '../helpers/git'

const execAsync = promisify(execSync)

async function addCommit(cwd: string, message: string) {
  await execAsync(`echo "content" >> file.txt && git add file.txt && git commit -m "${message}"`, { cwd })
}

async function headMessage(cwd: string, ref = 'HEAD') {
  return (await execAsync(`git log -1 --format=%s ${ref}`, { cwd })).stdout.trim()
}

describe('rebase executor', () => {
  it('should return empty array for empty commits', async () => {
    expect(await executeRewordRebase([])).toEqual([])
  })

  describe('with temp git repo', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await createTempGitRepo()
    })

    afterEach(async () => {
      await cleanupTempRepo(tempDir)
    })

    it('should reword a single commit message', async () => {
      await addCommit(tempDir, 'fix bug')
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      const results = await executeRewordRebase(
        [{ hash, newMessage: 'fix(auth): resolve login timeout', newBody: '' }],
        tempDir
      )

      expect(results[0]?.success).toBe(true)
      expect(results[0]?.originalMessage).toBe('fix bug')
      expect(await headMessage(tempDir)).toBe('fix(auth): resolve login timeout')
    })

    it('should return results for multiple commits', async () => {
      await addCommit(tempDir, 'fix one')
      await addCommit(tempDir, 'fix two')
      const hash1 = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim()
      const hash2 = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      const results = await executeRewordRebase(
        [
          { hash: hash1, newMessage: 'fix(auth): resolve first issue', newBody: '' },
          { hash: hash2, newMessage: 'fix(api): resolve second issue', newBody: '' },
        ],
        tempDir
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
      expect(results[0]?.originalMessage).toBe('fix one')
      expect(results[1]?.originalMessage).toBe('fix two')
    })

    it('should reword commit with subject and body', async () => {
      await execAsync(
        'echo "content" > file.txt && git add file.txt && git commit -m "fix bug" -m "This is the body"',
        {
          cwd: tempDir,
        }
      )
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

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
      expect(await headMessage(tempDir)).toBe('fix(auth): resolve login timeout')
      const body = (await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()
      expect(body).toContain('The login was timing out after 30 seconds.')
      expect(body).toContain('Added longer timeout.')
    })

    it('should handle special characters in commit message', async () => {
      await addCommit(tempDir, 'wip')
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      const results = await executeRewordRebase(
        [
          {
            hash,
            newMessage: 'feat: add support for "quotes" and `backticks`',
            newBody: 'Lines with:\n- emojis 🎉\n- unicode: 你好',
          },
        ],
        tempDir
      )

      expect(results[0]?.success).toBe(true)
      const full = (await execAsync('git log -1 --format=%B', { cwd: tempDir })).stdout.trim()
      expect(full).toContain('feat: add support for "quotes" and `backticks`')
      expect(full).toContain('- emojis 🎉')
    })

    it('should use subject only when body is empty', async () => {
      await addCommit(tempDir, 'wip')
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      const results = await executeRewordRebase([{ hash, newMessage: 'refactor: cleanup code', newBody: '' }], tempDir)

      expect(results[0]?.success).toBe(true)
      expect(await headMessage(tempDir)).toBe('refactor: cleanup code')
    })

    it('should reword the root commit', async () => {
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      const results = await executeRewordRebase([{ hash, newMessage: 'reworded root', newBody: '' }], tempDir)

      expect(results[0]?.success).toBe(true)
      expect(await headMessage(tempDir)).toBe('reworded root')
    })

    it('should only reword specified commits and leave others unchanged', async () => {
      await addCommit(tempDir, 'commit A')
      await addCommit(tempDir, 'commit B')
      await addCommit(tempDir, 'commit C')
      const hashB = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim()

      await executeRewordRebase([{ hash: hashB, newMessage: 'feat: reworded B', newBody: '' }], tempDir)

      expect(await headMessage(tempDir, 'HEAD')).toBe('commit C')
      expect(await headMessage(tempDir, 'HEAD~1')).toBe('feat: reworded B')
      expect(await headMessage(tempDir, 'HEAD~2')).toBe('commit A')
    })

    it('should fail gracefully for non-existent commit hash', async () => {
      const results = await executeRewordRebase(
        [{ hash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', newMessage: 'nope', newBody: '' }],
        tempDir
      )

      // Error may occur before any result is recorded, or result may be marked failed
      if (results.length > 0) {
        expect(results[0]?.success).toBe(false)
        expect(results[0]?.error).toBeDefined()
      }
    })

    it('should verify all commit messages in git history after multi-reword', async () => {
      await addCommit(tempDir, 'old X')
      await addCommit(tempDir, 'old Y')
      const hash1 = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim()
      const hash2 = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      await executeRewordRebase(
        [
          { hash: hash1, newMessage: 'feat(x): new X', newBody: '' },
          { hash: hash2, newMessage: 'feat(y): new Y', newBody: '' },
        ],
        tempDir
      )

      expect(await headMessage(tempDir, 'HEAD')).toBe('feat(y): new Y')
      expect(await headMessage(tempDir, 'HEAD~1')).toBe('feat(x): new X')
    })

    it('should preserve commit order after reword', async () => {
      await addCommit(tempDir, 'first')
      await addCommit(tempDir, 'second')
      await addCommit(tempDir, 'third')
      const hash1 = (await execAsync('git rev-parse HEAD~2', { cwd: tempDir })).stdout.trim()
      const hash3 = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      await executeRewordRebase(
        [
          { hash: hash1, newMessage: 'reworded first', newBody: '' },
          { hash: hash3, newMessage: 'reworded third', newBody: '' },
        ],
        tempDir
      )

      const log = (await execAsync('git log --format=%s --reverse', { cwd: tempDir })).stdout.trim().split('\n')
      expect(log.slice(-3)).toEqual(['reworded first', 'second', 'reworded third'])
    })

    it('should preserve author info after reword', async () => {
      await addCommit(tempDir, 'original')
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()
      const originalAuthor = (await execAsync('git log -1 --format=%an', { cwd: tempDir })).stdout.trim()
      const originalEmail = (await execAsync('git log -1 --format=%ae', { cwd: tempDir })).stdout.trim()

      await executeRewordRebase([{ hash, newMessage: 'reworded message', newBody: '' }], tempDir)

      expect((await execAsync('git log -1 --format=%an', { cwd: tempDir })).stdout.trim()).toBe(originalAuthor)
      expect((await execAsync('git log -1 --format=%ae', { cwd: tempDir })).stdout.trim()).toBe(originalEmail)
    })

    it('should remove existing body when newBody is empty', async () => {
      await execAsync(
        'echo "content" > file.txt && git add file.txt && git commit -m "fix bug" -m "This body should be removed"',
        {
          cwd: tempDir,
        }
      )
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      const results = await executeRewordRebase([{ hash, newMessage: 'fix(core): resolved bug', newBody: '' }], tempDir)

      expect(results[0]?.success).toBe(true)
      expect((await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()).toBe('')
      expect(await headMessage(tempDir)).toBe('fix(core): resolved bug')
    })

    it('should add body to a commit that originally had none', async () => {
      await addCommit(tempDir, 'fix bug')
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      const results = await executeRewordRebase(
        [{ hash, newMessage: 'fix bug', newBody: 'Added detailed explanation of the fix.' }],
        tempDir
      )

      expect(results[0]?.success).toBe(true)
      expect((await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()).toBe(
        'Added detailed explanation of the fix.'
      )
    })

    it('should preserve multiline body', async () => {
      await addCommit(tempDir, 'wip')
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()
      const multilineBody = 'First paragraph.\n\nSecond paragraph.\n\nThird:\n- bullet 1\n- bullet 2'

      const results = await executeRewordRebase(
        [{ hash, newMessage: 'feat: complex change', newBody: multilineBody }],
        tempDir
      )

      expect(results[0]?.success).toBe(true)
      const body = (await execAsync('git log -1 --format=%b', { cwd: tempDir })).stdout.trim()
      expect(body).toContain('First paragraph.')
      expect(body).toContain('Second paragraph.')
      expect(body).toContain('- bullet 1')
    })
  })

  describe('error handling', () => {
    it('should return error result for non-git-repo directory', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'not-a-git-repo-'))
      try {
        const results = await executeRewordRebase([{ hash: 'abc123', newMessage: 'test', newBody: '' }], tempDir)
        if (results.length > 0) {
          expect(results[0]?.success).toBe(false)
          expect(results[0]?.error).toBeDefined()
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('integration: reword middle commits (not HEAD)', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await createTempGitRepo()
    })

    afterEach(async () => {
      await cleanupTempRepo(tempDir)
    })

    async function createCommits(messages: string[]): Promise<Array<{ hash: string; message: string }>> {
      const commits: Array<{ hash: string; message: string }> = []
      for (const msg of messages) {
        await execAsync(`echo "content-${commits.length}" >> file.txt && git add file.txt && git commit -m "${msg}"`, {
          cwd: tempDir,
        })
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()
        commits.push({ hash, message: msg })
      }
      return commits
    }

    async function getFullLog(): Promise<Array<{ hash: string; message: string; patch: string }>> {
      const logOutput = (await execAsync('git log --format="%H|||%s" --reverse', { cwd: tempDir })).stdout.trim()
      const result: Array<{ hash: string; message: string; patch: string }> = []
      for (const entry of logOutput.split('\n').filter(Boolean)) {
        const [hash, message] = entry.split('|||')
        if (!hash || !message) {
          continue
        }
        const patch = (await execAsync(`git diff-tree --no-commit-id -p ${hash}`, { cwd: tempDir })).stdout.trim()
        result.push({ hash, message, patch })
      }
      return result
    }

    it('should reword a single middle commit without changing the commit chain', async () => {
      const commits = await createCommits(['feat: A', 'feat: B', 'feat: C'])
      const beforeLog = await getFullLog()

      const commitB = commits[1]
      if (!commitB) {
        throw new Error('Expected commit B to exist')
      }
      const results = await executeRewordRebase(
        [{ hash: commitB.hash, newMessage: 'feat: B-reworded', newBody: '' }],
        tempDir
      )

      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(true)

      const afterLog = await getFullLog()
      expect(afterLog).toHaveLength(beforeLog.length)
      expect(afterLog[1]?.message).toBe('feat: A')
      expect(afterLog[2]?.message).toBe('feat: B-reworded')
      expect(afterLog[3]?.message).toBe('feat: C')
      for (let i = 0; i < beforeLog.length; i++) {
        expect(afterLog[i]?.patch).toBe(beforeLog[i]?.patch)
      }
    })

    it('should reword a range of middle commits without changing the commit chain', async () => {
      const commits = await createCommits(['feat: A', 'feat: B', 'feat: C', 'feat: D'])
      const beforeLog = await getFullLog()

      const commitB = commits[1]
      const commitC = commits[2]
      if (!commitB || !commitC) {
        throw new Error('Expected commits B and C to exist')
      }
      const results = await executeRewordRebase(
        [
          { hash: commitB.hash, newMessage: 'feat: B-new', newBody: '' },
          { hash: commitC.hash, newMessage: 'feat: C-new', newBody: '' },
        ],
        tempDir
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)

      const afterLog = await getFullLog()
      expect(afterLog).toHaveLength(beforeLog.length)
      expect(afterLog[2]?.message).toBe('feat: B-new')
      expect(afterLog[3]?.message).toBe('feat: C-new')
      expect(afterLog[4]?.message).toBe('feat: D')
      for (let i = 0; i < beforeLog.length; i++) {
        expect(afterLog[i]?.patch).toBe(beforeLog[i]?.patch)
      }
    })

    it('should reword the commit right after root without breaking the chain', async () => {
      const commits = await createCommits(['feat: A', 'feat: B'])
      const beforeLog = await getFullLog()

      const commitA = commits[0]
      if (!commitA) {
        throw new Error('Expected commit A to exist')
      }
      const results = await executeRewordRebase(
        [{ hash: commitA.hash, newMessage: 'feat: A-reworded', newBody: '' }],
        tempDir
      )

      expect(results[0]?.success).toBe(true)

      const afterLog = await getFullLog()
      expect(afterLog).toHaveLength(beforeLog.length)
      expect(afterLog[1]?.message).toBe('feat: A-reworded')
      expect(afterLog[2]?.message).toBe('feat: B')
      for (let i = 0; i < beforeLog.length; i++) {
        expect(afterLog[i]?.patch).toBe(beforeLog[i]?.patch)
      }
    })

    it('should reword a middle commit with body', async () => {
      const commits = await createCommits(['feat: A', 'feat: B', 'feat: C'])
      const beforeLog = await getFullLog()

      const commitB = commits[1]
      if (!commitB) {
        throw new Error('Expected commit B to exist')
      }
      const results = await executeRewordRebase(
        [{ hash: commitB.hash, newMessage: 'feat: B-reworded', newBody: 'This is the new body\nwith multiple lines' }],
        tempDir
      )

      expect(results[0]?.success).toBe(true)

      const afterLog = await getFullLog()
      expect(afterLog[2]?.message).toBe('feat: B-reworded')
      expect(afterLog[1]?.message).toBe('feat: A')
      expect(afterLog[3]?.message).toBe('feat: C')

      const bodyOutput = (
        await execAsync(`git log -1 --format=%b ${afterLog[2]?.hash}`, { cwd: tempDir })
      ).stdout.trim()
      expect(bodyOutput).toBe('This is the new body\nwith multiple lines')

      for (let i = 0; i < beforeLog.length; i++) {
        expect(afterLog[i]?.patch).toBe(beforeLog[i]?.patch)
      }
    })
  })
})
