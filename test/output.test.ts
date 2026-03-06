import { describe, expect, it } from 'vitest'
import { formatError, formatPreview, formatPreviewJsonl, formatResult, formatResultJsonl } from '../src/output'

describe('formatResult', () => {
  it('should mark success with ✓ and short hash', () => {
    const output = formatResult([
      { success: true, commit: 'abc123def456', originalMessage: 'old', newMessage: 'new', newBody: '' },
    ])
    expect(output).toContain('✓')
    expect(output).toContain('abc123d rewrote')
  })

  it('should mark failure with ✗ and include error', () => {
    const output = formatResult([
      {
        success: false,
        commit: 'abc123def456',
        originalMessage: 'old',
        newMessage: 'new',
        newBody: '',
        error: 'rebase failed',
      },
    ])
    expect(output).toContain('✗')
    expect(output).toContain('abc123d failed')
    expect(output).toContain('Error: rebase failed')
  })

  it('should include success/total summary', () => {
    const results = [
      { success: true, commit: 'aaa111', originalMessage: 'a', newMessage: 'b', newBody: '' },
      { success: true, commit: 'bbb222', originalMessage: 'c', newMessage: 'd', newBody: '' },
      { success: false, commit: 'ccc333', originalMessage: 'e', newMessage: 'f', newBody: '', error: 'fail' },
    ]
    expect(formatResult(results)).toContain('2/3 commits rewrote')
  })

  it('should handle empty results', () => {
    expect(formatResult([])).toContain('0/0 commits rewrote')
  })
})

describe('formatPreview', () => {
  it('should include short hash, OLD and NEW labels', () => {
    const output = formatPreview([
      { commit: 'abc123def456', originalMessage: 'old message', newMessage: 'new message' },
    ])
    expect(output).toContain('abc123d:')
    expect(output).toContain('OLD:')
    expect(output).toContain('NEW:')
  })

  it('should render all items', () => {
    const output = formatPreview([
      { commit: 'aaa111', originalMessage: 'old1', newMessage: 'new1' },
      { commit: 'bbb222', originalMessage: 'old2', newMessage: 'new2' },
    ])
    expect(output).toContain('aaa111:')
    expect(output).toContain('bbb222:')
  })

  it('should return Preview header for empty input', () => {
    expect(formatPreview([])).toBe('\nPreview:')
  })
})

describe('formatError', () => {
  it('should format error message', () => {
    expect(formatError('Something went wrong')).toContain('Error: Something went wrong')
  })

  it('should include hint when provided', () => {
    const output = formatError('Something went wrong', 'Try again')
    expect(output).toContain('Error: Something went wrong')
    expect(output).toContain('Hint: Try again')
  })
})

describe('formatResultJsonl', () => {
  it('should produce one JSON object per result with all fields', () => {
    const output = formatResultJsonl([
      {
        success: true,
        commit: 'abc123def456',
        originalMessage: 'old message',
        newMessage: 'feat: new',
        newBody: 'body text',
      },
    ])
    const parsed = JSON.parse(output)
    expect(parsed).toMatchObject({
      success: true,
      commit: 'abc123def456',
      shortCommit: 'abc123d',
      originalMessage: 'old message',
      newMessage: 'feat: new',
      newBody: 'body text',
    })
  })

  it('should produce one line per result', () => {
    const results = [
      { success: true, commit: 'aaa111', originalMessage: 'a', newMessage: 'b', newBody: '' },
      { success: false, commit: 'bbb222', originalMessage: 'c', newMessage: 'd', newBody: '', error: 'fail' },
    ]
    const lines = formatResultJsonl(results).split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).success).toBe(true)
    expect(JSON.parse(lines[1]).error).toBe('fail')
  })

  it('should return empty string for empty input', () => {
    expect(formatResultJsonl([])).toBe('')
  })

  it('should truncate shortCommit to 7 chars', () => {
    const parsed = JSON.parse(
      formatResultJsonl([{ success: true, commit: 'abc123', originalMessage: 'a', newMessage: 'b', newBody: '' }])
    )
    expect(parsed.shortCommit).toBe('abc123')
  })
})

describe('formatPreviewJsonl', () => {
  it('should produce one JSON object per item with shortCommit', () => {
    const parsed = JSON.parse(
      formatPreviewJsonl([{ commit: 'abc123def456', originalMessage: 'old', newMessage: 'new' }])
    )
    expect(parsed.shortCommit).toBe('abc123d')
    expect(parsed.commit).toBe('abc123def456')
  })

  it('should produce one line per item', () => {
    const lines = formatPreviewJsonl([
      { commit: 'aaa111', originalMessage: 'a', newMessage: 'b' },
      { commit: 'bbb222', originalMessage: 'c', newMessage: 'd' },
    ]).split('\n')
    expect(lines).toHaveLength(2)
  })
})
