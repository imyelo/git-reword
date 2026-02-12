import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
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
    prompt: PROMPTS.rewrite(commit.message, commit.body, diff),
    output: Output.object({ schema: messageSchema }),
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
    prompt: PROMPTS.staged(diff),
    output: Output.object({ schema: messageSchema }),
  })

  return result.output as { message: string; reasoning?: string }
}

const BASE_PROMPT = `Requirements:
- Use format: type(scope): description
- type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Be concise but descriptive`

const PROMPTS = {
  rewrite: (message: string, body: string | undefined, diff: string) =>
    `Rewrite this commit message to follow Conventional Commits.

Original message:
${message}
${body ? `Body:\n${body}\n` : ''}Diff:
${diff}

${BASE_PROMPT}
- Keep the same semantic intent`,

  staged: (diff: string) =>
    `Generate a conventional commit message for these staged changes.

Diff:
${diff}

${BASE_PROMPT}`,
}
const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.0-flash-exp',
  openai: 'gpt-4o',
} as const

function getProvider(config: Config) {
  switch (config.provider) {
    case 'anthropic':
      return (model?: string) => anthropic(model || DEFAULT_MODELS.anthropic)
    case 'google':
      return (model?: string) => google(model || DEFAULT_MODELS.google)
    default:
      return (model?: string) => openai(model || DEFAULT_MODELS.openai)
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
