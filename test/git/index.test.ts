import { exec as execSync } from 'node:child_process'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkBranchContains, checkUncommittedChanges, getCommits } from '../../src/git'
import { cleanupTempRepo, createTempGitRepo } from '../helpers/git'

const execAsync = promisify(execSync)

async function addCommit(cwd: string, message: string) {
  await execAsync(`echo "${message}" >> file.txt && git add file.txt && git commit -m "${message}"`, { cwd })
}

describe('git operations', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempGitRepo()
  })

  afterEach(async () => {
    await cleanupTempRepo(tempDir)
  })

  describe('getCommits', () => {
    it('should get all commits from repo', async () => {
      const commits = await getCommits({}, tempDir)
      expect(commits.length).toBeGreaterThanOrEqual(1)
      expect(commits[0]?.hash).toBeDefined()
      expect(commits[0]?.message).toBe('initial commit')
    })

    it('should get last N commits in newest-first order', async () => {
      await addCommit(tempDir, 'feat: feature 1')
      await addCommit(tempDir, 'feat: feature 2')
      await addCommit(tempDir, 'feat: feature 3')

      const commits = await getCommits({ last: 2 }, tempDir)
      expect(commits).toHaveLength(2)
      expect(commits[0]?.message).toBe('feat: feature 3')
      expect(commits[1]?.message).toBe('feat: feature 2')
    })

    it('should get commits after a specific ref', async () => {
      await addCommit(tempDir, 'feat: feature 1')
      const sinceHash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()
      await addCommit(tempDir, 'feat: feature 2')

      const commits = await getCommits({ since: sinceHash }, tempDir)
      expect(commits).toHaveLength(1)
      expect(commits[0]?.message).toBe('feat: feature 2')
    })

    it('should get commits in a hash range', async () => {
      await addCommit(tempDir, 'feat: feature 1')
      await addCommit(tempDir, 'feat: feature 2')
      const from = (await execAsync('git rev-parse HEAD~1', { cwd: tempDir })).stdout.trim()
      const to = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()

      const commits = await getCommits({ range: `${from}..${to}` }, tempDir)
      expect(commits).toHaveLength(1)
      expect(commits[0]?.message).toBe('feat: feature 2')
    })
  })

  describe('checkUncommittedChanges', () => {
    it('should return false when working tree is clean', async () => {
      expect(await checkUncommittedChanges(tempDir)).toBe(false)
    })

    it('should return true when there are uncommitted changes', async () => {
      await execAsync('echo "new content" >> file.txt', { cwd: tempDir })
      expect(await checkUncommittedChanges(tempDir)).toBe(true)
    })
  })

  describe('checkBranchContains', () => {
    it('should return true when commit is on current branch', async () => {
      const hash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()
      expect(await checkBranchContains(hash, tempDir)).toBe(true)
    })

    it('should return false for a non-existent hash', async () => {
      expect(await checkBranchContains('a'.repeat(40), tempDir)).toBe(false)
    })

    it('should return false when commit exists only on another branch', async () => {
      await execAsync('git checkout -b feature', { cwd: tempDir })
      await addCommit(tempDir, 'feat: feature commit')
      const featureHash = (await execAsync('git rev-parse HEAD', { cwd: tempDir })).stdout.trim()
      await execAsync('git checkout -', { cwd: tempDir })

      expect(await checkBranchContains(featureHash, tempDir)).toBe(false)
    })
  })
})
