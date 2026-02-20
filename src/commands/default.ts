import { Args, Command, Flags } from '@oclif/core'
import inquirer from 'inquirer'
import { generateCommitMessage, generateStagedMessage } from '../ai/generator.js'
import { type Config, hasConfig, loadConfig, saveConfig } from '../config.js'
import { ErrorCode, GitRewordError, handleError } from '../error.js'
import { checkBranchContains, checkUncommittedChanges, getCommits } from '../git/index.js'
import { getSimpleGit } from '../git/simple-git.js'
import { formatPreviewJsonl, formatResultJsonl } from '../output.js'
import { checkFastForward } from '../preflight.js'
import { executeRewordRebase } from '../rebase/index.js'
import type { Commit } from '../types.js'
import { selectCommits } from '../ui/render-selector.js'
import { confirm } from '../ui.js'

type RewriteResult = Array<{ hash: string; originalMessage: string; newMessage: string; newBody: string }>

// Generate commit message rewrites (shared by dry-run and normal mode)
async function generateRewrites(commits: Commit[], flags: ParsedFlags, config: Config): Promise<RewriteResult | null> {
  const generateMessage = async (commit: { hash: string; message: string }) => {
    const fullCommit = commits.find(c => c.hash === commit.hash)
    if (!fullCommit) {
      return { message: commit.message, body: '' }
    }
    const generated = await generateCommitMessage(fullCommit, config)
    return { message: generated.subject, body: generated.body }
  }

  if (flags.yes) {
    // Skip selector, generate all
    const rewrites: RewriteResult = []
    for (const commit of commits) {
      const result = await generateMessage({ hash: commit.hash, message: commit.message })
      rewrites.push({
        hash: commit.hash,
        originalMessage: commit.message,
        newMessage: result.message,
        newBody: result.body,
      })
    }
    return rewrites
  }

  // Show interactive selector with live generation
  const selected = await selectCommits(
    commits.map(c => ({ hash: c.hash, message: c.message, body: c.body })),
    generateMessage
  )

  if (!selected) {
    return null // Aborted
  }

  return selected
}

// Flags interface for runtime parsed values (after oclif processing)
interface ParsedFlags {
  staged: boolean
  'dry-run': boolean
  yes: boolean
  provider?: string
  model?: string
  last?: number
  since?: string
  'skip-check': boolean
  config: boolean
  format?: 'text' | 'jsonl'
  apply: boolean
}

class MainCommand extends Command {
  static summary = 'AI-powered Git commit message rewriter'

  static args = {
    ref: Args.string({
      description: 'Commit, range (e.g., HEAD~3..HEAD), or branch to reword',
      required: false,
    }),
  }

  static flags = {
    staged: Flags.boolean({
      char: 's',
      description: 'Generate commit message for staged changes',
      default: false,
    }),
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Preview changes without executing',
      default: false,
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation and apply all changes',
      default: false,
    }),
    provider: Flags.string({
      description: 'AI provider (openai, anthropic, google)',
    }),
    model: Flags.string({
      description: 'Model name',
    }),
    last: Flags.integer({
      char: 'n',
      description: 'Number of recent commits to reword',
      min: 1,
    }),
    since: Flags.string({
      description: 'Reword commits from the commit after this ref to HEAD',
    }),
    'skip-check': Flags.boolean({
      char: 'k',
      description: 'Skip uncommitted changes check (for debugging)',
      default: false,
    }),
    config: Flags.boolean({
      char: 'c',
      description: 'Configure git-reword settings interactively',
      default: false,
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format: text (default) or jsonl (for AI agent consumption)',
      options: ['text', 'jsonl'],
      default: 'text',
    }),
    apply: Flags.boolean({
      char: 'a',
      description: 'Apply pre-confirmed rewrites from stdin (JSONL format). Skips AI generation.',
      default: false,
    }),
  }

  async run() {
    const { args, flags } = await this.parse(MainCommand)
    const parsed = flags as ParsedFlags

    try {
      if (parsed.config) {
        return this.runConfig()
      }

      // Check if config exists, prompt user to configure if not
      if (!(await hasConfig())) {
        const response = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'configure',
            message: 'No configuration found. Would you like to configure git-reword now?',
            default: true,
          },
        ])

        if (response.configure) {
          return this.runConfig()
        }
        throw new GitRewordError(
          'Configuration required. Run `git-reword --config` to configure.',
          ErrorCode.CONFIG_ERROR
        )
      }

      let config: Config
      try {
        config = await loadConfig()
      } catch {
        throw new GitRewordError('Failed to load configuration.', ErrorCode.CONFIG_ERROR)
      }

      if (parsed.staged) {
        return this.runStaged(parsed, config)
      }

      return this.runReword(args.ref, parsed, config)
    } catch (error) {
      const exitCode = handleError(error)
      this.exit(exitCode)
    }
  }

  private async runConfig() {
    let currentConfig: Config = {}
    try {
      currentConfig = await loadConfig()
    } catch {
      // No config yet
    }

    const questions = [
      {
        type: 'list' as const,
        name: 'provider',
        message: 'Select AI provider',
        choices: ['openai', 'anthropic', 'google'],
        default: currentConfig.provider || 'openai',
      },
      {
        type: 'input' as const,
        name: 'model',
        message: 'Model name (optional, press Enter to skip)',
        default: currentConfig.model || '',
      },
      {
        type: 'input' as const,
        name: 'apiKey',
        message: 'API Key (optional, press Enter to skip)',
        default: currentConfig.apiKey || '',
      },
      {
        type: 'input' as const,
        name: 'baseUrl',
        message: 'Base URL (optional, for custom endpoints)',
        default: currentConfig.baseUrl || '',
      },
      {
        type: 'input' as const,
        name: 'systemPrompt',
        message: 'System prompt (optional)',
        default: currentConfig.systemPrompt || '',
      },
    ]

    const answers = await inquirer.prompt(questions)
    const newConfig = Object.fromEntries(
      Object.entries(answers).filter(([, v]) => v !== undefined && v !== '')
    ) as Config

    await saveConfig(newConfig)
    this.log('\nConfiguration saved to ~/.git-rewordrc')
    this.log('You can also edit this file directly.')
  }

  private async runReword(ref: string | undefined, flags: ParsedFlags, config: Config) {
    // Determine if ref is a range or single commit
    let options: { commit?: string; range?: string; last?: number; since?: string } = {}
    if (ref) {
      if (ref.includes('..')) {
        // Range format: aaa..bbb
        options = { range: ref }
      } else {
        // Single commit
        options = { commit: ref }
      }
    } else if (flags.last) {
      options = { last: flags.last }
    } else if (flags.since) {
      options = { since: flags.since }
    }

    // Pre-flight checks (skip with --skip-check for debugging)
    if (!flags['skip-check']) {
      if (await checkUncommittedChanges()) {
        throw new GitRewordError(
          'Uncommitted changes detected. Please commit or stash them first.',
          ErrorCode.GIT_ERROR
        )
      }

      if (!(await checkFastForward(options))) {
        throw new GitRewordError(
          'Cannot fast-forward to target commits. They may have been rebased or amended. Run "git reflog" to check.',
          ErrorCode.GIT_ERROR
        )
      }
    }

    const commits = await getCommits(options)

    // Validate commits are on current branch
    if (options.commit) {
      if (!(await checkBranchContains(options.commit))) {
        throw new GitRewordError(
          `Commit '${options.commit}' is not on the current branch. Please checkout the correct branch first.`,
          ErrorCode.INVALID_ARGS
        )
      }
    } else if (options.range) {
      const [from, to] = options.range.split('..')
      if (!(await checkBranchContains(from)) || !(await checkBranchContains(to))) {
        throw new GitRewordError(
          `One or more commits in range '${options.range}' are not on the current branch. Please checkout the correct branch first.`,
          ErrorCode.INVALID_ARGS
        )
      }
    } else if (options.since) {
      if (!(await checkBranchContains(options.since))) {
        throw new GitRewordError(
          `Commit '${options.since}' is not on the current branch. Please checkout the correct branch first.`,
          ErrorCode.INVALID_ARGS
        )
      }
    }
    // Note: --last doesn't need validation as it always operates on current branch's last N commits

    // Generate new messages
    const selectedRewrites = await generateRewrites(commits, flags, config)

    if (!selectedRewrites) {
      return // User aborted
    }

    // Dry-run: show preview without executing
    if (flags['dry-run']) {
      const previewItems = selectedRewrites.map(r => ({
        commit: r.hash,
        originalMessage: r.originalMessage,
        newMessage: r.newMessage,
      }))

      if (flags.format === 'jsonl') {
        this.log(formatPreviewJsonl(previewItems))
      } else {
        this.log('\n--- Dry Run: Would apply these rewrites ---')
        for (const r of selectedRewrites) {
          this.log(`\n${r.hash.substring(0, 7)}:`)
          this.log(`  original: ${r.originalMessage}`)
          this.log(`  new:      ${r.newMessage}`)
          if (r.newBody) {
            this.log(`  body:     ${r.newBody.split('\n').join('\n          ')}`)
          }
        }
        this.log('\n--- End dry run ---\n')
      }
      return
    }

    // Execute rebase
    const results = await executeRewordRebase(
      selectedRewrites.map(r => ({ hash: r.hash, newMessage: r.newMessage, newBody: r.newBody }))
    )

    // Report results
    if (flags.format === 'jsonl') {
      this.log(formatResultJsonl(results))
    } else {
      let successCount = 0
      for (const result of results) {
        if (result.success) {
          this.log(`✓ ${result.commit.substring(0, 7)} rewrote`)
          successCount++
        } else {
          this.log(`✗ ${result.commit.substring(0, 7)} failed: ${result.error}`)
        }
      }
      this.log(`Done. ${successCount}/${results.length} commits rewrote`)
    }
  }

  private async runStaged(flags: ParsedFlags, config: Config) {
    const git = await getSimpleGit()

    const status = await git.status()

    if (status.staged.length === 0) {
      throw new GitRewordError('No staged changes. Stage your changes first with `git add`.', ErrorCode.INVALID_ARGS)
    }

    const diff = await git.diff(['--staged', '-p'])

    const generated = await generateStagedMessage(diff, config)
    const fullMessage = generated.body ? `${generated.subject}\n\n${generated.body}` : generated.subject

    this.log(`\nSuggested message:\n`)
    this.log(fullMessage)
    this.log(`\n`)

    if (!flags.yes) {
      const response = await confirm('Apply this commit? [y/n] ')
      if (response) {
        await git.commit(fullMessage)
        this.log('Committed!')
      } else {
        throw new GitRewordError('Commit cancelled by user.', ErrorCode.USER_INTERRUPT)
      }
    }
  }
}

export { MainCommand, generateRewrites }
export default MainCommand
