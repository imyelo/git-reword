import { checkBranchContains } from './git/index.js'

export interface ApplyRewrite {
  commit: string
  newMessage: string
  newBody?: string
}

export interface ApplyError {
  type: 'empty' | 'parse' | 'missing_field' | 'commit_not_found'
  line?: number
  message: string
}

export async function parseStdinRewrites(stdin: string): Promise<{ rewrites: ApplyRewrite[]; errors: ApplyError[] }> {
  const lines = stdin.split('\n').filter(line => line.trim() !== '')
  const rewrites: ApplyRewrite[] = []
  const errors: ApplyError[] = []

  if (lines.length === 0) {
    errors.push({ type: 'empty', message: 'No input provided' })
    return { rewrites, errors }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>

      if (!parsed.commit || typeof parsed.commit !== 'string') {
        errors.push({
          type: 'missing_field',
          line: i + 1,
          message: 'Missing required field: commit',
        })
        continue
      }

      if (!parsed.newMessage || typeof parsed.newMessage !== 'string') {
        errors.push({
          type: 'missing_field',
          line: i + 1,
          message: 'Missing required field: newMessage',
        })
        continue
      }

      rewrites.push({
        commit: parsed.commit,
        newMessage: parsed.newMessage,
        newBody: typeof parsed.newBody === 'string' ? parsed.newBody : '',
      })
    } catch {
      errors.push({
        type: 'parse',
        line: i + 1,
        message: 'Invalid JSON',
      })
    }
  }

  return { rewrites, errors }
}

export async function validateCommitsExist(rewrites: ApplyRewrite[]): Promise<ApplyError[]> {
  const errors: ApplyError[] = []

  for (const rewrite of rewrites) {
    const exists = await checkBranchContains(rewrite.commit)
    if (!exists) {
      errors.push({
        type: 'commit_not_found',
        message: `Commit '${rewrite.commit}' not found in current branch`,
      })
    }
  }

  return errors
}
