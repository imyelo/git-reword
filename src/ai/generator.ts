import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
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
  })

  // Parse the structured output from text response
  const parsed = messageSchema.parse(JSON.parse(result.text))
  return { message: parsed.message, reasoning: parsed.reasoning }
}

export async function generateStagedMessage(
  diff: string,
  config: Config
): Promise<{ message: string; reasoning?: string }> {
  const provider = getProvider(config)

  const result = await generateText({
    model: provider(config.model),
    prompt: PROMPTS.staged(diff),
  })

  // Parse the structured output from text response
  const parsed = messageSchema.parse(JSON.parse(result.text))
  return { message: parsed.message, reasoning: parsed.reasoning }
}

const BASE_PROMPT = `Requirements:
- Use format: type(scope): description
- type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Be concise but descriptive

Response in JSON format:
{
  "message": "type(scope): description",
  "reasoning": "brief explanation"
}`

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
  const commonOptions = {
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    headers: config.headers,
  }

  switch (config.provider) {
    case 'anthropic':
      return (model?: string) => createAnthropic(commonOptions)(model || DEFAULT_MODELS.anthropic)
    case 'google':
      return (model?: string) => createGoogleGenerativeAI(commonOptions)(model || DEFAULT_MODELS.google)
    default:
      return (model?: string) =>
        createOpenAI({
          ...commonOptions,
          organization: config.organization,
        })(model || DEFAULT_MODELS.openai)
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
