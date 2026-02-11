import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import type { Commit, Config } from '../types'

const messageSchema = {
  type: 'object' as const,
  properties: {
    message: {
      type: 'string' as const,
      description: 'Conventional commit message (type(scope): description)',
    },
    reasoning: {
      type: 'string' as const,
      description: 'Brief explanation of the message choice',
    },
  },
  required: ['message'],
}

export async function generateCommitMessage(
  commit: Commit,
  config: Config,
): Promise<{ message: string; reasoning: string }> {
  const provider = getProvider(config)

  const diff = await getCommitDiff(commit.hash)

  const result = await generateObject({
    model: provider(config.model),
    schema: messageSchema,
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
  })

  return result.object
}

export async function generateStagedMessage(
  diff: string,
  config: Config,
): Promise<{ message: string; reasoning: string }> {
  const provider = getProvider(config)

  const result = await generateObject({
    model: provider(config.model),
    schema: messageSchema,
    prompt: `Generate a conventional commit message for these staged changes.

Diff:
${diff}

Requirements:
- Use format: type(scope): description
- type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Be concise but descriptive`,
  })

  return result.object
}

function getProvider(config: Config) {
  switch (config.provider) {
    case 'anthropic':
      return (model?: string) => anthropic({ model: model || 'claude-sonnet-4-20250514' })
    case 'google':
      return (model?: string) => google({ model: model || 'gemini-2.0-flash-exp' })
    default:
      return (model?: string) => openai({ model: model || 'gpt-4o' })
  }
}

async function getCommitDiff(hash: string): Promise<string> {
  const { default: simpleGit } = await import('simple-git')
  try {
    const diff = await simpleGit().show([`${hash}^..${hash}`, '--stat', '-p'])
    return diff
  } catch {
    return ''
  }
}
