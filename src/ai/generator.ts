import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { Config } from '../config.js'
import { getSimpleGit } from '../git/simple-git.js'
import type { Commit } from '../types.js'

const messageSchema = z.object({
  subject: z.string().describe('Conventional commit subject line (type(scope): description)'),
  body: z.string().describe('Commit body/description (optional, leave empty if not needed)'),
  reasoning: z.string().optional().describe('Brief explanation of the message choice'),
})

const MAX_RETRIES = 3
const BASE_DELAY = 1000 // ms

interface RetryableError extends Error {
  code?: string
  status?: number
}

function isRetryableError(error: unknown): boolean {
  const err = error as RetryableError
  const message = (err.message || '').toLowerCase()
  const status = err.status || err.code

  // Rate limit errors
  if (status === 429 || message.includes('rate_limit') || message.includes('rate limit') || message.includes('429')) {
    return true
  }

  // Server errors
  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503')
  ) {
    return true
  }

  // Network errors
  if (message.includes('network') || message.includes('econnrefused') || message.includes('etimedout')) {
    return true
  }

  return false
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw lastError
      }

      // Don't retry on last attempt
      if (attempt === MAX_RETRIES - 1) {
        throw lastError
      }

      // Exponential backoff
      const delay = BASE_DELAY * 2 ** attempt
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export async function generateCommitMessage(
  commit: Commit,
  config: Config
): Promise<{ subject: string; body: string; reasoning?: string }> {
  return withRetry(async () => {
    const provider = getProvider(config)

    const diff = await getCommitDiff(commit.hash, config.maxDiffChars)

    const result = await generateObject({
      model: provider(config.model),
      schema: messageSchema,
      prompt: PROMPTS.rewrite(commit.message, commit.body, diff),
    })

    return { subject: result.object.subject, body: result.object.body, reasoning: result.object.reasoning }
  })
}

export async function generateStagedMessage(
  diff: string,
  config: Config
): Promise<{ subject: string; body: string; reasoning?: string }> {
  return withRetry(async () => {
    const provider = getProvider(config)

    const result = await generateObject({
      model: provider(config.model),
      schema: messageSchema,
      prompt: PROMPTS.staged(diff),
    })

    return { subject: result.object.subject, body: result.object.body, reasoning: result.object.reasoning }
  })
}

const BASE_PROMPT = `Requirements:
- Use format: type(scope): description
- type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Be concise but descriptive`

const PROMPTS = {
  rewrite: (message: string, body: string | undefined, diff: string) =>
    `Rewrite this commit message to follow Conventional Commits. Optimize both the subject line and body.

Original subject:
${message}
${body ? `Original body:\n${body}\n` : ''}Diff:
${diff}

${BASE_PROMPT}
- Keep the same semantic intent
- Output both "subject" (the commit line) and "body" (detailed description)
- If the original body is not needed or can be merged into the subject, return an empty body`,

  staged: (diff: string) =>
    `Generate a conventional commit message for these staged changes.

Diff:
${diff}

${BASE_PROMPT}
- Output both "subject" (the commit line) and "body" (detailed description)`,
}
const DEFAULT_MODELS = {
  anthropic: 'claude-haiku-4-5',
  google: 'gemini-2.5-flash',
  openai: 'gpt-5-mini',
} as const

function getProvider(config: Config) {
  const commonOptions = {
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    headers: config.headers as Record<string, string> | undefined,
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

const DEFAULT_MAX_DIFF_CHARS = 50_000 // ~50KB

async function getCommitDiff(hash: string, maxChars?: number): Promise<string> {
  const git = await getSimpleGit()
  const limit = maxChars || DEFAULT_MAX_DIFF_CHARS

  try {
    const diff = await git.show([`${hash}^..${hash}`, '--stat', '-p'])

    // Truncate if exceeds limit
    if (diff.length > limit) {
      const truncated = diff.slice(0, limit)
      return `${truncated}\n\n[Diff truncated - showing first ${limit.toLocaleString()} characters]`
    }

    return diff
  } catch {
    return ''
  }
}
