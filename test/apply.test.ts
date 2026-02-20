import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseStdinRewrites, validateCommitsExist } from '../src/apply.js'
import * as gitModule from '../src/git/index.js'

describe('parseStdinRewrites', () => {
  it('should parse valid JSONL', async () => {
    const input = '{"commit":"abc123","newMessage":"fix: resolved"}\n{"commit":"def456","newMessage":"feat: added"}'
    const { rewrites, errors } = await parseStdinRewrites(input)

    expect(errors).toHaveLength(0)
    expect(rewrites).toHaveLength(2)
    expect(rewrites[0].commit).toBe('abc123')
    expect(rewrites[0].newMessage).toBe('fix: resolved')
    expect(rewrites[1].commit).toBe('def456')
  })

  it('should handle empty input', async () => {
    const { rewrites, errors } = await parseStdinRewrites('')

    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('empty')
    expect(rewrites).toHaveLength(0)
  })

  it('should reject missing commit field', async () => {
    const input = '{"newMessage":"fix: resolved"}'
    const { rewrites, errors } = await parseStdinRewrites(input)

    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing_field')
    expect(rewrites).toHaveLength(0)
  })

  it('should reject missing newMessage field', async () => {
    const input = '{"commit":"abc123"}'
    const { rewrites, errors } = await parseStdinRewrites(input)

    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing_field')
    expect(rewrites).toHaveLength(0)
  })

  it('should reject invalid JSON', async () => {
    const input = '{"commit": invalid}'
    const { rewrites, errors } = await parseStdinRewrites(input)

    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('parse')
    expect(rewrites).toHaveLength(0)
  })

  it('should accept optional newBody field', async () => {
    const input = '{"commit":"abc123","newMessage":"fix: resolved","newBody":"detailed explanation"}'
    const { rewrites, errors } = await parseStdinRewrites(input)

    expect(errors).toHaveLength(0)
    expect(rewrites[0].newBody).toBe('detailed explanation')
  })
})

describe('validateCommitsExist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty errors when commits exist', async () => {
    vi.spyOn(gitModule, 'checkBranchContains').mockResolvedValue(true)

    const rewrites = [{ commit: 'abc123', newMessage: 'fix' }]
    const errors = await validateCommitsExist(rewrites)

    expect(errors).toHaveLength(0)
  })

  it('should return error when commit does not exist', async () => {
    vi.spyOn(gitModule, 'checkBranchContains').mockResolvedValue(false)

    const rewrites = [{ commit: 'abc123', newMessage: 'fix' }]
    const errors = await validateCommitsExist(rewrites)

    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('commit_not_found')
  })
})
