import type { RewordOptions } from '../types.js'

export type { RewordOptions }

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
