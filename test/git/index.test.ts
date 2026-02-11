import { describe, it, expect } from 'vitest'
import { getCommits, checkUncommittedChanges, checkBranchContains } from '../../src/git'

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
