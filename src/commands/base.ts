import { Args, Command, Flags } from '@oclif/core'
import { loadConfig } from '../config.js'

export abstract class BaseCommand extends Command {
  static flags = {
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
  }

  static args = {
    commit: Args.string({
      description: 'Specific commit to reword',
    }),
  }

  protected async loadConfig() {
    return loadConfig()
  }
}
