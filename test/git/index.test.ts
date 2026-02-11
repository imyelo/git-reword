import { describe, expect, it } from 'vitest'
import { checkBranchContains, checkUncommittedChanges, getCommits } from '../../src/git'

describe('git operations', () => {
  it('should export getCommits function', () => {
    expect(typeof getCommits).toBe('function')
  })

  it('should export checkUncommittedChanges function', () => {
    expect(typeof checkUncommittedChanges).toBe('function')
  })

  it('should export checkBranchContains function', () => {
    expect(typeof checkBranchContains).toBe('function')
  })
})
