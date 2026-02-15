import { Command, Flags } from '@oclif/core'
import inquirer, { type Question } from 'inquirer'
import { type Config, loadConfig, saveConfig } from '../config.js'

export default class ConfigCommand extends Command {
  static description = 'Configure git-reword settings'

  static flags = {
    show: Flags.boolean({
      char: 's',
      description: 'Show current configuration',
      default: false,
    }),
  }

  async run() {
    const { flags } = await this.parse(ConfigCommand)

    if (flags.show) {
      return this.showConfig()
    }

    return this.configure()
  }

  private async showConfig() {
    try {
      const config = await loadConfig()
      this.log('Current configuration:')
      this.log(JSON.stringify(config, null, 2))
    } catch {
      this.log('No configuration found. Run `git-reword config` to configure.')
    }
  }

  private async configure() {
    let currentConfig: Config = {}
    try {
      currentConfig = await loadConfig()
    } catch {
      // No config yet, use empty object
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
}
