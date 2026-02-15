import { Args, Command, Flags } from '@oclif/core'
import inquirer, { type Question } from 'inquirer'
import { generateCommitMessage, generateStagedMessage } from '../ai/generator.js'
import { type Config, hasConfig, loadConfig, saveConfig } from '../config.js'
import { checkBranchContains, checkUncommittedChanges, getCommits } from '../git/index.js'
import { getSimpleGit } from '../git/simple-git.js'
import { executeRewordRebase } from '../rebase/index.js'
import type { Commit } from '../types.js'
import { selectCommits } from '../ui/render-selector.jsx'
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
  }

  async run() {
    const { args, flags } = await this.parse(MainCommand)
    const parsed = flags as ParsedFlags

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
      this.error('Configuration required. Run `git-reword --config` to configure.')
    }

    const config = await loadConfig()

    if (parsed.staged) {
      return this.runStaged(parsed, config)
    }

    return this.runReword(args.ref, parsed, config)
  }

  private async runConfig() {
    let currentConfig: Config = {}
    try {
      currentConfig = await loadConfig()
    } catch {
      // No config yet
    }

    const questions: Question[] = [
      {
        type: 'list',
        name: 'provider',
        message: 'Select AI provider',
        choices: ['openai', 'anthropic', 'google'],
        default: currentConfig.provider || 'openai',
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name (optional, press Enter to skip)',
        default: currentConfig.model || '',
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'API Key (optional, press Enter to skip)',
        default: currentConfig.apiKey || '',
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Base URL (optional, for custom endpoints)',
        default: currentConfig.baseUrl || '',
      },
      {
        type: 'input',
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
    // Pre-flight: check uncommitted changes (skip with --skip-check for debugging)
    if (!flags['skip-check'] && (await checkUncommittedChanges())) {
      this.error('Uncommitted changes detected. Please commit or stash them first.')
    }

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

    const commits = await getCommits(options)

    // Validate commits are on current branch
    if (options.commit) {
      if (!(await checkBranchContains(options.commit))) {
        this.error(`Commit '${options.commit}' is not on the current branch. Please checkout the correct branch first.`)
      }
    } else if (options.range) {
      const [from, to] = options.range.split('..')
      if (!(await checkBranchContains(from)) || !(await checkBranchContains(to))) {
        this.error(
          `One or more commits in range '${options.range}' are not on the current branch. Please checkout the correct branch first.`
        )
      }
    } else if (options.since) {
      if (!(await checkBranchContains(options.since))) {
        this.error(`Commit '${options.since}' is not on the current branch. Please checkout the correct branch first.`)
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
      return
    }

    // Execute rebase
    const results = await executeRewordRebase(
      selectedRewrites.map(r => ({ hash: r.hash, newMessage: r.newMessage, newBody: r.newBody }))
    )

    // Report results
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

  private async runStaged(flags: ParsedFlags, config: Config) {
    const git = await getSimpleGit()

    const status = await git.status()

    if (status.staged.length === 0) {
      this.error('No staged changes. Stage your changes first with `git add`.')
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
        this.log('Commit cancelled.')
      }
    }
  }
}

export { MainCommand, generateRewrites }
export default MainCommand
