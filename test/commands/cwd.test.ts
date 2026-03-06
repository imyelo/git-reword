import { exec as execSync } from 'node:child_process'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempRepo, createTempGitRepo } from '../helpers/git'

const execAsync = promisify(execSync)

vi.mock('ai', () => ({ generateObject: vi.fn() }))

vi.mock('../../src/config.js', () => ({
  hasConfig: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}))

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }))

import { generateObject } from 'ai'
import MainCommand from '../../src/commands/default'
import { hasConfig, loadConfig } from '../../src/config.js'

describe('--cwd flag', () => {
  let tempDir: string
  let logs: string[]
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.clearAllMocks()
    tempDir = await createTempGitRepo()
    logs = []

    const { Command } = await import('@oclif/core')
    logSpy = vi.spyOn(Command.prototype, 'log').mockImplementation((msg?: string) => {
      logs.push(String(msg ?? ''))
    })

    vi.mocked(hasConfig).mockResolvedValue(true)
    vi.mocked(loadConfig).mockResolvedValue({ provider: 'openai', model: 'gpt-4o' })

    await execAsync('echo "content" >> file.txt && git add file.txt && git commit -m "fix: old message"', {
      cwd: tempDir,
    })
  })

  afterEach(async () => {
    logSpy.mockRestore()
    await cleanupTempRepo(tempDir)
  })

  it('should read commits from the specified directory', async () => {
    vi.mocked(generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { subject: 'fix: improved message', body: '' },
    })

    await MainCommand.run(['--last', '1', '--yes', '--dry-run', '--skip-check', '--cwd', tempDir], import.meta.url)

    const output = logs.join('\n')
    expect(output).toContain('fix: old message')
    expect(output).toContain('fix: improved message')
  })

  it('should detect uncommitted changes in the specified directory', async () => {
    // Stage a file without committing in the temp repo
    await execAsync('echo "dirty" >> dirty.txt && git add dirty.txt', { cwd: tempDir })

    const err = await MainCommand.run(['--last', '1', '--cwd', tempDir], import.meta.url).catch(e => e)
    expect(err?.message).toContain('Uncommitted changes')
  })
})
