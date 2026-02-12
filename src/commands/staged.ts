import { createInterface } from 'node:readline'
import { generateStagedMessage } from '../ai/generator.js'
import { BaseCommand } from './base.js'
import { getSimpleGit } from '../git/simple-git.js'

async function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.toLowerCase().startsWith('y'))
    })
  })
}

export class StagedCommand extends BaseCommand {
  static summary = 'Generate commit message for staged changes'

  async run() {
    const { flags } = await this.parse(StagedCommand)
    const config = await this.loadConfig()
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
