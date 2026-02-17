import { describe, expect, it } from 'vitest'
import { formatError, formatPreview, formatPreviewJsonl, formatResult, formatResultJsonl } from '../src/output'

describe('output formatter', () => {
  it('should export formatPreview function', () => {
    expect(typeof formatPreview).toBe('function')
  })

  it('should export formatResult function', () => {
    expect(typeof formatResult).toBe('function')
  })

  it('should export formatError function', () => {
    expect(typeof formatError).toBe('function')
  })

  it('should export formatResultJsonl function', () => {
    expect(typeof formatResultJsonl).toBe('function')
  })

  it('should export formatPreviewJsonl function', () => {
    expect(typeof formatPreviewJsonl).toBe('function')
  })
})

describe('formatResultJsonl', () => {
  it('should output one JSON object per line', () => {
    const results = [
      {
        success: true,
        commit: 'abc123def456',
        originalMessage: 'old message',
        newMessage: 'feat: new message',
        newBody: 'body text',
      },
    ]
    const output = formatResultJsonl(results)
    const lines = output.split('\n')
    expect(lines).toHaveLength(1)
  })

  it('should include all fields in output', () => {
    const results = [
      {
        success: true,
        commit: 'abc123def456',
        originalMessage: 'old message',
        newMessage: 'feat: new message',
        newBody: 'body text',
      },
    ]
    const output = formatResultJsonl(results)
    const parsed = JSON.parse(output)
    expect(parsed.success).toBe(true)
    expect(parsed.commit).toBe('abc123def456')
    expect(parsed.shortCommit).toBe('abc123d')
    expect(parsed.originalMessage).toBe('old message')
    expect(parsed.newMessage).toBe('feat: new message')
    expect(parsed.newBody).toBe('body text')
  })

  it('should handle multiple results', () => {
    const results = [
      { success: true, commit: 'aaa111', originalMessage: 'a', newMessage: 'b', newBody: '' },
      { success: false, commit: 'bbb222', originalMessage: 'c', newMessage: 'd', newBody: '', error: 'fail' },
    ]
    const output = formatResultJsonl(results)
    const lines = output.split('\n')
    expect(lines).toHaveLength(2)

    const parsed1 = JSON.parse(lines[0])
    expect(parsed1.success).toBe(true)
    expect(parsed1.error).toBeUndefined()

    const parsed2 = JSON.parse(lines[1])
    expect(parsed2.success).toBe(false)
    expect(parsed2.error).toBe('fail')
  })

  it('should handle empty results', () => {
    const output = formatResultJsonl([])
    expect(output).toBe('')
  })
})

describe('formatPreviewJsonl', () => {
  it('should output one JSON object per line', () => {
    const items = [{ commit: 'abc123def456', originalMessage: 'old', newMessage: 'new' }]
    const output = formatPreviewJsonl(items)
    const lines = output.split('\n')
    expect(lines).toHaveLength(1)
  })

  it('should include shortCommit field', () => {
    const items = [{ commit: 'abc123def456', originalMessage: 'old', newMessage: 'new' }]
    const output = formatPreviewJsonl(items)
    const parsed = JSON.parse(output)
    expect(parsed.shortCommit).toBe('abc123d')
  })

  it('should handle multiple preview items', () => {
    const items = [
      { commit: 'aaa111', originalMessage: 'a', newMessage: 'b' },
      { commit: 'bbb222', originalMessage: 'c', newMessage: 'd' },
    ]
    const output = formatPreviewJsonl(items)
    const lines = output.split('\n')
    expect(lines).toHaveLength(2)
  })
})
