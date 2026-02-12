import { exec } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export async function createTempGitRepo(): Promise<string> {
  const tempDir = await mkdtemp('git-reword-test-')
  await execAsync('git init', { cwd: tempDir })
  await execAsync('git config user.email "test@example.com"', { cwd: tempDir })
  await execAsync('git config user.name "Test User"', { cwd: tempDir })
  await execAsync('git config commit.gpgsign false', { cwd: tempDir })
  // Create initial commit
  await execAsync('echo "initial" > README.md', { cwd: tempDir })
  await execAsync('git add README.md', { cwd: tempDir })
  await execAsync('git commit -m "initial commit"', { cwd: tempDir })
  return tempDir
}

export async function cleanupTempRepo(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}
