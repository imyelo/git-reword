import { describe, expect, it } from 'vitest'
import { checkBranchContains, checkUncommittedChanges, getCommits } from '../../src/git'
import { cleanupTempRepo, createTempGitRepo } from '../helpers/git'

describe('git operations', () => {
  describe('getCommits', () => {
    it('should export getCommits function', () => {
      expect(typeof getCommits).toBe('function')
    })

    it('should get commits from temp repo', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const commits = await getCommits({}, tempDir)
        expect(commits.length).toBeGreaterThanOrEqual(1)
        expect(commits[0]?.hash).toBeDefined()
        expect(commits[0]?.message).toBe('initial commit')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should get last N commits', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        await execAsync('echo "feat1" >> file.txt && git add file.txt && git commit -m "feat: feature 1"', {
          cwd: tempDir,
        })
        await execAsync('echo "feat2" >> file.txt && git add file.txt && git commit -m "feat: feature 2"', {
          cwd: tempDir,
        })
        await execAsync('echo "feat3" >> file.txt && git add file.txt && git commit -m "feat: feature 3"', {
          cwd: tempDir,
        })

        const commits = await getCommits({ last: 2 }, tempDir)
        expect(commits).toHaveLength(2)
        // Most recent first
        expect(commits[0]?.message).toBe('feat: feature 3')
        expect(commits[1]?.message).toBe('feat: feature 2')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should get commits since a specific commit', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        await execAsync('echo "feat1" >> file.txt && git add file.txt && git commit -m "feat: feature 1"', {
          cwd: tempDir,
        })
        const sinceHash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()
        await execAsync('echo "feat2" >> file.txt && git add file.txt && git commit -m "feat: feature 2"', {
          cwd: tempDir,
        })

        const commits = await getCommits({ since: sinceHash }, tempDir)
        expect(commits.length).toBeGreaterThanOrEqual(1)
        expect(commits[commits.length - 1]?.message).toBe('feat: feature 2')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should get commits in a range', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        await execAsync('echo "feat1" >> file.txt && git add file.txt && git commit -m "feat: feature 1"', {
          cwd: tempDir,
        })
        await execAsync('echo "feat2" >> file.txt && git add file.txt && git commit -m "feat: feature 2"', {
          cwd: tempDir,
        })
        const hash1 = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim()
        const hash2 = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        const commits = await getCommits({ range: `${hash1}..${hash2}` }, tempDir)
        expect(commits).toHaveLength(1)
        expect(commits[0]?.message).toBe('feat: feature 2')
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })
  })

  describe('checkUncommittedChanges', () => {
    it('should export checkUncommittedChanges function', () => {
      expect(typeof checkUncommittedChanges).toBe('function')
    })

    it('should return false when no uncommitted changes', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const hasChanges = await checkUncommittedChanges(tempDir)
        expect(hasChanges).toBe(false)
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should return true when there are uncommitted changes', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        await execAsync('echo "new content" >> file.txt', { cwd: tempDir })

        const hasChanges = await checkUncommittedChanges(tempDir)
        expect(hasChanges).toBe(true)
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })
  })

  describe('checkBranchContains', () => {
    it('should export checkBranchContains function', () => {
      expect(typeof checkBranchContains).toBe('function')
    })

    it('should return true when branch contains commit', async () => {
      const tempDir = await createTempGitRepo()
      try {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

        const contains = await checkBranchContains(hash, tempDir)
        expect(contains).toBe(true)
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })

    it('should return false when branch does not contain commit', async () => {
      const tempDir = await createTempGitRepo()
      try {
        // Use a non-existent hash that will trigger the error handling
        const fakeHash = 'a'.repeat(40)

        const contains = await checkBranchContains(fakeHash, tempDir)
        expect(contains).toBe(false)
      } finally {
        await cleanupTempRepo(tempDir)
      }
    })
  })
})
