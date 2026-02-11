export interface Commit {
  hash: string
  shortHash: string
  message: string
  body: string
}

export interface RewordOptions {
  last?: number
  since?: string
  range?: string
  commit?: string
  dryRun?: boolean
  yes?: boolean
  staged?: boolean
  provider?: AiProvider
  model?: string
}

export type AiProvider = 'openai' | 'anthropic' | 'google'
