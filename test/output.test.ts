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

describe('formatResult (text format - regression)', () => {
  it('should output success message with short hash', () => {
    const results = [
      {
        success: true,
        commit: 'abc123def456',
        originalMessage: 'old message',
        newMessage: 'feat: new message',
        newBody: '',
      },
    ]
    const output = formatResult(results)
    expect(output).toContain('abc123d rewrote')
    expect(output).toContain('✓')
  })

  it('should output failure message with error', () => {
    const results = [
      {
        success: false,
        commit: 'abc123def456',
        originalMessage: 'old message',
        newMessage: 'feat: new message',
        newBody: '',
        error: 'rebase failed',
      },
    ]
    const output = formatResult(results)
    expect(output).toContain('abc123d failed')
    expect(output).toContain('Error: rebase failed')
    expect(output).toContain('✗')
  })

  it('should include summary count', () => {
    const results = [
      { success: true, commit: 'aaa111', originalMessage: 'a', newMessage: 'b', newBody: '' },
      { success: true, commit: 'bbb222', originalMessage: 'c', newMessage: 'd', newBody: '' },
      { success: false, commit: 'ccc333', originalMessage: 'e', newMessage: 'f', newBody: '', error: 'fail' },
    ]
    const output = formatResult(results)
    expect(output).toContain('2/3 commits rewrote')
  })

  it('should handle empty results', () => {
    const output = formatResult([])
    expect(output).toContain('0/0 commits rewrote')
  })

  it('should handle all successful results', () => {
    const results = [
      { success: true, commit: 'aaa111', originalMessage: 'a', newMessage: 'b', newBody: '' },
      { success: true, commit: 'bbb222', originalMessage: 'c', newMessage: 'd', newBody: '' },
    ]
    const output = formatResult(results)
    expect(output).toContain('2/2 commits rewrote')
  })

  // Boundary tests - short commit hash
  it('should handle 6-character hash', () => {
    const results = [{ success: true, commit: 'abc123', originalMessage: 'a', newMessage: 'b', newBody: '' }]
    const output = formatResult(results)
    expect(output).toContain('abc123 rewrote')
  })

  it('should handle 1-character hash', () => {
    const results = [{ success: true, commit: 'a', originalMessage: 'a', newMessage: 'b', newBody: '' }]
    const output = formatResult(results)
    expect(output).toContain('a rewrote')
  })

  it('should handle empty string hash', () => {
    const results = [{ success: true, commit: '', originalMessage: 'a', newMessage: 'b', newBody: '' }]
    const output = formatResult(results)
    expect(output).toContain(' rewrote')
  })
})

describe('formatPreview (text format - regression)', () => {
  it('should output preview with short hash', () => {
    const items = [{ commit: 'abc123def456', originalMessage: 'old message', newMessage: 'feat: new message' }]
    const output = formatPreview(items)
    expect(output).toContain('abc123d:')
    expect(output).toContain('OLD:')
    expect(output).toContain('NEW:')
  })

  it('should handle multiple items', () => {
    const items = [
      { commit: 'aaa111', originalMessage: 'old1', newMessage: 'new1' },
      { commit: 'bbb222', originalMessage: 'old2', newMessage: 'new2' },
    ]
    const output = formatPreview(items)
    expect(output).toContain('aaa111:')
    expect(output).toContain('bbb222:')
  })

  it('should handle empty items', () => {
    const output = formatPreview([])
    expect(output).toBe('\nPreview:')
  })

  // Boundary tests - short commit hash
  it('should handle 6-character hash', () => {
    const items = [{ commit: 'abc123', originalMessage: 'old', newMessage: 'new' }]
    const output = formatPreview(items)
    expect(output).toContain('abc123:')
  })

  it('should handle 1-character hash', () => {
    const items = [{ commit: 'a', originalMessage: 'old', newMessage: 'new' }]
    const output = formatPreview(items)
    expect(output).toContain('a:')
  })

  it('should handle empty string hash', () => {
    const items = [{ commit: '', originalMessage: 'old', newMessage: 'new' }]
    const output = formatPreview(items)
    expect(output).toContain(':')
  })
})

describe('formatError', () => {
  it('should format error message', () => {
    const output = formatError('Something went wrong')
    expect(output).toContain('Error: Something went wrong')
  })

  it('should include hint when provided', () => {
    const output = formatError('Something went wrong', 'Try again')
    expect(output).toContain('Error: Something went wrong')
    expect(output).toContain('Hint: Try again')
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

describe('boundary conditions', () => {
  describe('short commit hash (less than 7 chars)', () => {
    it('should handle 6-character hash in formatResultJsonl', () => {
      const results = [{ success: true, commit: 'abc123', originalMessage: 'a', newMessage: 'b', newBody: '' }]
      const output = formatResultJsonl(results)
      const parsed = JSON.parse(output)
      expect(parsed.shortCommit).toBe('abc123')
    })

    it('should handle 1-character hash in formatResultJsonl', () => {
      const results = [{ success: true, commit: 'a', originalMessage: 'a', newMessage: 'b', newBody: '' }]
      const output = formatResultJsonl(results)
      const parsed = JSON.parse(output)
      expect(parsed.shortCommit).toBe('a')
    })

    it('should handle 6-character hash in formatPreviewJsonl', () => {
      const items = [{ commit: 'abc123', originalMessage: 'old', newMessage: 'new' }]
      const output = formatPreviewJsonl(items)
      const parsed = JSON.parse(output)
      expect(parsed.shortCommit).toBe('abc123')
    })

    it('should handle empty string hash', () => {
      const results = [{ success: true, commit: '', originalMessage: 'a', newMessage: 'b', newBody: '' }]
      const output = formatResultJsonl(results)
      const parsed = JSON.parse(output)
      expect(parsed.shortCommit).toBe('')
    })
  })

  describe('empty and undefined fields', () => {
    it('should handle undefined newBody', () => {
      const results = [{ success: true, commit: 'abc123def', originalMessage: 'a', newMessage: 'b' }] as never
      const output = formatResultJsonl(results as never)
      const parsed = JSON.parse(output)
      expect(parsed.newBody).toBeUndefined()
    })
  })
})

// End-to-end integration tests for JSONL output format
describe('JSONL output format integration', () => {
  it('should produce valid JSONL that can be parsed line by line', () => {
    const results = [
      {
        success: true,
        commit: 'abc123def456',
        originalMessage: 'fix bug',
        newMessage: 'fix(auth): resolve login',
        newBody: '',
      },
      {
        success: true,
        commit: 'def456789abc',
        originalMessage: 'add feature',
        newMessage: 'feat(api): add endpoint',
        newBody: 'Additional details',
      },
      {
        success: false,
        commit: 'ghi789jkl012',
        originalMessage: 'wip',
        newMessage: 'draft: work in progress',
        newBody: '',
        error: 'rebase conflict',
      },
    ]
    const output = formatResultJsonl(results)

    // Each line should be valid JSON
    const lines = output.split('\n')
    expect(lines).toHaveLength(3)

    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('should produce JSONL that can be streamed (one object per line)', () => {
    const results = [
      { success: true, commit: 'aaa111bbb222', originalMessage: 'old1', newMessage: 'new1', newBody: '' },
      { success: true, commit: 'ccc333ddd444', originalMessage: 'old2', newMessage: 'new2', newBody: '' },
    ]
    const output = formatResultJsonl(results)

    // Simulate streaming: parse each line as it arrives
    const parsed = output.split('\n').map(line => JSON.parse(line))
    expect(parsed).toHaveLength(2)
    expect(parsed[0].commit).toBe('aaa111bbb222')
    expect(parsed[1].commit).toBe('ccc333ddd444')
  })

  it('should produce JSONL suitable for AI agent consumption', () => {
    // Simulate AI agent processing: read JSONL line by line
    const results = [
      {
        success: true,
        commit: 'abc123def456',
        originalMessage: 'fix bug',
        newMessage: 'fix(auth): resolve issue',
        newBody: '',
      },
    ]
    const output = formatResultJsonl(results)

    // AI agent can easily parse this
    const lines = output.split('\n')
    for (const line of lines) {
      const obj = JSON.parse(line)
      // Verify all fields needed for AI processing are present
      expect(obj).toHaveProperty('success')
      expect(obj).toHaveProperty('commit')
      expect(obj).toHaveProperty('shortCommit')
      expect(obj).toHaveProperty('originalMessage')
      expect(obj).toHaveProperty('newMessage')
    }
  })

  it('should match text format behavior for shortCommit extraction', () => {
    // Verify JSONL shortCommit matches text format's implicit truncation
    const results = [{ success: true, commit: 'abc123def456', originalMessage: 'a', newMessage: 'b', newBody: '' }]

    const jsonlOutput = formatResultJsonl(results)
    const jsonlParsed = JSON.parse(jsonlOutput)

    // Text format uses substring(0, 7), JSONL should match
    expect(jsonlParsed.shortCommit).toBe('abc123d')
  })
})
