import { loadConfig as loadC12 } from 'c12'
import { z } from 'zod'

const configSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  systemPrompt: z.string().optional(),
})

export type Config = z.infer<typeof configSchema>

export async function loadConfig(): Promise<Config> {
  const { config } = await loadC12({
    name: 'git-reword',
    configFile: 'config.json',
  })
  return configSchema.parse(config || {})
}

export function getProviderConfig(config: Config) {
  return {
    provider: config.provider || 'openai',
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  }
}
