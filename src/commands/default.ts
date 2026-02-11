import { Flags } from '@oclif/core'
import { BaseCommand } from './base'
import { getCommits, checkUncommittedChanges } from '../git'
import { generateCommitMessage } from '../ai/generator'
import { executeRewordRebase, type RewordResult } from '../rebase'

export class DefaultCommand extends BaseCommand {
  static summary = 'Reword the most recent commit'

  static flags = {
    ...BaseCommand.flags,
    last: Flags.integer({
      char: 'n',
      description: 'Number of recent commits to reword',
      min: 1,
    }),
  }

  async run() {
    const { flags } = await this.parse(DefaultCommand)
    const config = await this.loadConfig()

    // Pre-flight: check uncommitted changes
    if (await checkUncommittedChanges()) {
      this.error('Uncommitted changes detected. Please commit or stash them first.')
    }

    // Get commits to reword
    const options = flags.last ? { last: flags.last } : {}
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
      const proceed = await this.confirm('\nApply these changes? [y/n]')
      if (!proceed) {
        this.log('Aborted.')
        return
      }
    }

    // Execute rebase
    const results = await executeRewordRebase(
      rewrites.map((r) => ({ hash: r.hash, newMessage: r.newMessage })),
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
}
