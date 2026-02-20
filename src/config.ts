import { readUser, writeUser } from 'rc9'
import { z } from 'zod'

const configSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  organization: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  systemPrompt: z.string().optional(),
  maxDiffChars: z.number().optional(),
})

export type Config = z.infer<typeof configSchema>

const CONFIG_NAME = '.git-rewordrc'

export async function loadConfig(): Promise<Config> {
  // rc9 reads ~/.git-rewordrc automatically using readUser
  const rawConfig = await readUser(CONFIG_NAME)
  return configSchema.parse(rawConfig)
}

export async function saveConfig(config: Config): Promise<void> {
  // rc9 writes config in key=value format automatically
  await writeUser(config, CONFIG_NAME)
}

export async function hasConfig(): Promise<boolean> {
  const fs = await import('node:fs/promises')
  const { homedir } = await import('node:os')
  try {
    await fs.access(`${homedir()}/${CONFIG_NAME}`)
    return true
  } catch {
    return false
  }
}

export function getProviderConfig(config: Config) {
  return {
    provider: config.provider || 'openai',
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  }
}
