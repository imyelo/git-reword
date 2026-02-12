import type { Commit, RewordOptions } from '../types.js'

export function parseCommit(logLine: string): Commit | null {
  const lines = logLine.trim().split('\n')
  if (lines.length < 1 || !lines[0]) {
    return null
  }

  const firstLine = lines[0].trim()
  // Check if first line has both hash and message
  const hashMatch = firstLine.match(/^(\S+)\s+(.+)$/)
  let hash: string
  let message: string

  if (hashMatch) {
    // Hash and message on same line
    hash = hashMatch[1]
    message = hashMatch[2]
  } else {
    // Only hash on first line, message may be on second
    hash = firstLine
    message = lines[1]?.trim() || ''
  }

  const body = lines
    .slice(message ? 2 : 1)
    .join('\n')
    .trim()

  return {
    hash,
    shortHash: hash.substring(0, 7),
    message,
    body,
  }
}

export function parseCommits(logOutput: string): Commit[] {
  return logOutput
    .split(/\n\n/)
    .filter(Boolean)
    .map(parseCommit)
    .filter((c): c is Commit => c !== null)
}

export function getCommitRange(options: RewordOptions): { from: string; to: string } | null {
  if (options.last) {
    const from = `HEAD~${options.last}`
    return { from, to: 'HEAD' }
  }
  if (options.since) {
    return { from: options.since, to: 'HEAD' }
  }
  if (options.range) {
    const [from, to] = options.range.split('..')
    return { from, to }
  }
  if (options.commit) {
    return { from: `${options.commit}^`, to: options.commit }
  }
  return null
}
