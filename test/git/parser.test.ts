import { describe, expect, it } from 'vitest'
import { type Commit, getCommitRange, parseCommit, parseCommits, type RewordOptions } from '../../src/git/parser'

describe('git parser', () => {
  it('should export parseCommit function', () => {
    expect(typeof parseCommit).toBe('function')
  })

  it('should export parseCommits function', () => {
    expect(typeof parseCommits).toBe('function')
  })

  it('should export getCommitRange function', () => {
    expect(typeof getCommitRange).toBe('function')
  })

  it('should parse a commit correctly', () => {
    const commitResult = parseCommit('abc1234\nfix: bug\n')
    expect(commitResult).not.toBeNull()
    const commit: Commit = commitResult
    expect(commit.hash).toBe('abc1234')
    expect(commit.message).toBe('fix: bug')
    expect(commit.shortHash).toBe('abc1234')
  })

  it('should return null for invalid input', () => {
    expect(parseCommit('')).toBeNull()
  })
})
