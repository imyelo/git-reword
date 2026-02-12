import { Args, Command, Flags } from '@oclif/core'
import { generateCommitMessage, generateStagedMessage } from '../ai/generator.js'
import { type Config, loadConfig } from '../config.js'
import { checkUncommittedChanges, getCommits } from '../git/index.js'
import { getSimpleGit } from '../git/simple-git.js'
import { executeRewordRebase } from '../rebase/index.js'
import { confirm } from '../ui.js'

// Flags interface for runtime parsed values (after oclif processing)
interface ParsedFlags {
  staged: boolean
  'dry-run': boolean
  yes: boolean
  provider?: string
  model?: string
  last?: number
}

class MainCommand extends Command {
  static summary = 'AI-powered Git commit message rewriter'

  static args = {
    commit: Args.string({
      description: 'Specific commit to reword',
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
  }

  async run() {
    const { args, flags } = await this.parse(MainCommand)
    const config = await loadConfig()
    const parsed = flags as ParsedFlags

    if (parsed.staged) {
      return this.runStaged(parsed, config)
    }

    return this.runReword(args.commit, parsed, config)
  }

  private async runReword(commit: string | undefined, flags: ParsedFlags, config: Config) {
    // Pre-flight: check uncommitted changes
    if (await checkUncommittedChanges()) {
      this.error('Uncommitted changes detected. Please commit or stash them first.')
    }

    // Get commits to reword
    const options = commit ? { commit } : flags.last ? { last: flags.last } : {}
    const commits = await getCommits(options)

    // Generate new messages
    const rewrites: Array<{ hash: string; originalMessage: string; newMessage: string }> = []

    for (const commit of commits) {
      const generated = await generateCommitMessage(commit, config)
      if (flags['dry-run']) {
        this.log(`[DRY-RUN] ${commit.shortHash}: ${commit.message} -> ${generated.message}`)
      } else {
        rewrites.push({
          hash: commit.hash,
          originalMessage: commit.message,
          newMessage: generated.message,
        })
      }
    }

    if (flags['dry-run']) {
      this.log('Dry run complete. Run without --dry-run to apply changes.')
      return
    }

    // Confirmation if not --yes
    if (!flags.yes) {
      this.log('\nCommit rewrites:')
      for (const r of rewrites) {
        this.log(`  ${r.hash.substring(0, 7)}: ${r.originalMessage} -> ${r.newMessage}`)
      }
      const proceed = await confirm('\nApply these changes? [y/n] ')
      if (!proceed) {
        this.log('Aborted.')
        return
      }
    }

    // Execute rebase
    const results = await executeRewordRebase(rewrites.map(r => ({ hash: r.hash, newMessage: r.newMessage })))

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
    this.log(`\nSuggested message:\n`)
    this.log(generated.message)
    this.log(`\n`)

    if (!flags.yes) {
      const response = await confirm('Apply this commit? [y/n] ')
      if (response) {
        await git.commit(generated.message)
        this.log('Committed!')
      } else {
        this.log('Commit cancelled.')
      }
    }
  }
}

export default MainCommand
