import { describe, expect, it } from 'vitest'
import { type Commit, getCommitRange, parseCommit, parseCommits, type RewordOptions } from '../../src/git/parser'

describe('git parser', () => {
  describe('parseCommit', () => {
    it('should export parseCommit function', () => {
      expect(typeof parseCommit).toBe('function')
    })

    it('should parse basic format correctly', () => {
      const commit = parseCommit('abc1234\nfix: bug\n')
      expect(commit).not.toBeNull()
      expect(commit?.hash).toBe('abc1234')
      expect(commit?.message).toBe('fix: bug')
      expect(commit?.shortHash).toBe('abc1234')
    })

    it('should parse conventional commits with scope', () => {
      const commit = parseCommit('abc1234\nfeat(scope): new feature')
      expect(commit).not.toBeNull()
      expect(commit?.hash).toBe('abc1234')
      expect(commit?.message).toBe('feat(scope): new feature')
    })

    it('should parse conventional commits without scope', () => {
      const commit = parseCommit('abc1234\nfeat: message')
      expect(commit).not.toBeNull()
      expect(commit?.hash).toBe('abc1234')
      expect(commit?.message).toBe('feat: message')
    })

    it('should handle long hash with shortHash extraction', () => {
      const commit = parseCommit('abc1234567890abcdef\nfix: bug')
      expect(commit).not.toBeNull()
      expect(commit?.hash).toBe('abc1234567890abcdef')
      expect(commit?.shortHash).toBe('abc1234')
    })

    it('should parse multi-line body', () => {
      const commit = parseCommit('abc1234\nfeat: title\n\nbody line 1\nbody line 2')
      expect(commit).not.toBeNull()
      expect(commit?.hash).toBe('abc1234')
      expect(commit?.message).toBe('feat: title')
      expect(commit?.body).toBe('body line 1\nbody line 2')
    })

    it('should handle special characters in message', () => {
      const commit = parseCommit('abc1234\nfeat: add emoji 🎉')
      expect(commit).not.toBeNull()
      expect(commit?.hash).toBe('abc1234')
      expect(commit?.message).toBe('feat: add emoji 🎉')
    })

    it('should return null for empty input', () => {
      expect(parseCommit('')).toBeNull()
    })

    it('should return null for whitespace only input', () => {
      expect(parseCommit('   \n\n')).toBeNull()
    })
  })

  describe('parseCommits', () => {
    it('should export parseCommits function', () => {
      expect(typeof parseCommits).toBe('function')
    })

    it('should parse multiple commits', () => {
      const commits = parseCommits('hash1\nmsg1\n\nhash2\nmsg2\n')
      expect(commits).toHaveLength(2)
      expect(commits[0]?.hash).toBe('hash1')
      expect(commits[0]?.message).toBe('msg1')
      expect(commits[1]?.hash).toBe('hash2')
      expect(commits[1]?.message).toBe('msg2')
    })

    it('should filter out empty lines', () => {
      const commits = parseCommits('hash1\nmsg1\n\n\n\nhash2\nmsg2')
      expect(commits).toHaveLength(2)
    })
  })

  describe('getCommitRange', () => {
    it('should export getCommitRange function', () => {
      expect(typeof getCommitRange).toBe('function')
    })

    it('should return correct range for --last option', () => {
      const result = getCommitRange({ last: 3 } as RewordOptions)
      expect(result).not.toBeNull()
      expect(result?.from).toBe('HEAD~3')
      expect(result?.to).toBe('HEAD')
    })

    it('should return correct range for --since option', () => {
      const result = getCommitRange({ since: 'abc123' } as RewordOptions)
      expect(result).not.toBeNull()
      expect(result?.from).toBe('abc123')
      expect(result?.to).toBe('HEAD')
    })

    it('should return correct range for --range option', () => {
      const result = getCommitRange({ range: 'abc123..def456' } as RewordOptions)
      expect(result).not.toBeNull()
      expect(result?.from).toBe('abc123')
      expect(result?.to).toBe('def456')
    })

    it('should return correct range for --commit option', () => {
      const result = getCommitRange({ commit: 'abc123' } as RewordOptions)
      expect(result).not.toBeNull()
      expect(result?.from).toBe('abc123^')
      expect(result?.to).toBe('abc123')
    })

    it('should return null when no options provided', () => {
      expect(getCommitRange({} as RewordOptions)).toBeNull()
    })
  })
})
