import { default as simpleGit } from 'simple-git'
import { generateStagedMessage } from '../ai/generator'
import { BaseCommand } from './base'

export class StagedCommand extends BaseCommand {
  static summary = 'Generate commit message for staged changes'

  async run() {
    const { flags } = await this.parse(StagedCommand)
    const config = await this.loadConfig()

    const git = simpleGit()
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
      const apply = await this.confirm('Apply this commit? [y/n]')
      if (apply) {
        await git.commit(generated.message)
        this.log('Committed!')
      } else {
        this.log('Commit cancelled.')
      }
    }
  }
}
