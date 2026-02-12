import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { generateText, zodSchema } from 'ai'
import { z } from 'zod'
import type { Config } from '../config.js'
import { getSimpleGit } from '../git/simple-git.js'
import type { Commit } from '../types.js'

const messageSchema = z.object({
  message: z.string().describe('Conventional commit message (type(scope): description)'),
  reasoning: z.string().optional().describe('Brief explanation of the message choice'),
})

export async function generateCommitMessage(
  commit: Commit,
  config: Config
): Promise<{ message: string; reasoning?: string }> {
  const provider = getProvider(config)

  const diff = await getCommitDiff(commit.hash)

  const result = await generateText({
    model: provider(config.model),
    prompt: `Rewrite this commit message to follow Conventional Commits.

Original message:
${commit.message}

${commit.body ? `Body:\n${commit.body}\n` : ''}

Diff:
${diff}

Requirements:
- Use format: type(scope): description
- type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Be concise but descriptive
- Keep the same semantic intent`,
    // @ts-expect-error - output with zodSchema is the recommended replacement for generateObject
    output: zodSchema(messageSchema),
  })

  return result.output as { message: string; reasoning?: string }
}

export async function generateStagedMessage(
  diff: string,
  config: Config
): Promise<{ message: string; reasoning?: string }> {
  const provider = getProvider(config)

  const result = await generateText({
    model: provider(config.model),
    prompt: `Generate a conventional commit message for these staged changes.

Diff:
${diff}

Requirements:
- Use format: type(scope): description
- type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Be concise but descriptive`,
    // @ts-expect-error - output with zodSchema is the recommended replacement for generateObject
    output: zodSchema(messageSchema),
  })

  return result.output as { message: string; reasoning?: string }
}

// Default models for each provider
const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.0-flash-exp',
  openai: 'gpt-4o',
} as const

// Provider model function type
type ProviderModel = (model?: string) => ReturnType<typeof anthropic>

function getProvider(config: Config): ProviderModel {
  const baseOptions = {
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  }

  switch (config.provider) {
    case 'anthropic': {
      const modelId = DEFAULT_MODELS.anthropic
      return (model?: string) =>
        anthropic({
          model: model || modelId,
          ...baseOptions,
        } as unknown as Parameters<typeof anthropic>[0])
    }
    case 'google': {
      const modelId = DEFAULT_MODELS.google
      return (model?: string) =>
        google({
          model: model || modelId,
          ...baseOptions,
        } as unknown as Parameters<typeof google>[0])
    }
    default: {
      const modelId = DEFAULT_MODELS.openai
      return (model?: string) =>
        openai({
          model: model || modelId,
          ...baseOptions,
        } as unknown as Parameters<typeof openai>[0])
    }
  }
}

async function getCommitDiff(hash: string): Promise<string> {
  const git = await getSimpleGit()
  try {
    const diff = await git.show([`${hash}^..${hash}`, '--stat', '-p'])
    return diff
  } catch {
    return ''
  }
}
