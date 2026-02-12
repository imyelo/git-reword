import type { RewordResult } from './rebase/index.js'

export interface PreviewItem {
  commit: string
  originalMessage: string
  newMessage: string
}

export function formatPreview(items: PreviewItem[]): string {
  const lines = ['\nPreview:']
  for (const item of items) {
    lines.push(`  ${item.commit.substring(0, 7)}:`)
    lines.push(`    OLD: "${item.originalMessage}"`)
    lines.push(`    NEW: "${item.newMessage}"`)
    lines.push('  ---')
  }
  return lines.join('\n')
}

export function formatResult(results: RewordResult[]): string {
  const lines: string[] = []

  for (const r of results) {
    if (r.success) {
      lines.push(`✓ ${r.commit.substring(0, 7)} rewrote`)
    } else {
      lines.push(`✗ ${r.commit.substring(0, 7)} failed`)
      if (r.error) {
        lines.push(`  Error: ${r.error}`)
      }
    }
  }

  const successCount = results.filter(r => r.success).length
  lines.push(`Done. ${successCount}/${results.length} commits rewrote`)

  return lines.join('\n')
}

export function formatError(message: string, hint?: string): string {
  const lines = [`Error: ${message}`]
  if (hint) {
    lines.push(`Hint: ${hint}`)
  }
  return lines.join('\n')
}
