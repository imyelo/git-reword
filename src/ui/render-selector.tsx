import { render } from 'ink'
import React from 'react'
import { CommitSelector } from './commit-selector.js'

interface CommitRewrite {
  hash: string
  originalMessage: string
  newMessage?: string
}

const _updateCallback: ((rewrites: CommitRewrite[]) => void) | null = null

const App: React.FC<{ rewrites: CommitRewrite[] }> = ({ rewrites }) => {
  return <CommitSelector rewrites={rewrites} />
}

export function createCommitSelector(rewrites: CommitRewrite[]) {
  const { rerender, unmount } = render(React.createElement(App, { rewrites }))

  return {
    update(rewrites: CommitRewrite[]) {
      rerender(React.createElement(App, { rewrites }))
    },
    unmount,
  }
}

export async function selectCommits(
  commits: Array<{ hash: string; message: string }>,
  onGenerate: (commit: { hash: string; message: string }) => Promise<string>
): Promise<Array<{ hash: string; originalMessage: string; newMessage: string }> | null> {
  // Initialize with all commits (no newMessage yet)
  const rewrites: CommitRewrite[] = commits.map(c => ({
    hash: c.hash,
    originalMessage: c.message,
  }))

  return new Promise(resolve => {
    // Render with initial state (all old messages, no new messages)
    const { unmount } = render(React.createElement(App, { rewrites }))

    // Listen for output from the component
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      const output = args.join(' ')
      if (output.startsWith('__SELECTED__:')) {
        try {
          const selected = JSON.parse(output.replace('__SELECTED__:', ''))
          unmount()
          console.log = originalLog
          resolve(selected)
        } catch {
          // Ignore parse errors
        }
      }
      originalLog(...args)
    }

    // Handle process exit
    const originalExit = process.exit
    process.exit = ((code?: number | string) => {
      unmount()
      console.log = originalLog
      process.exit = originalExit
      if (code === 1 || code === '1') {
        resolve(null)
      } else {
        originalExit(code)
      }
    }) as typeof process.exit

    // Generate new messages serially, updating UI after each
    ;(async () => {
      const generatedRewrites: CommitRewrite[] = commits.map(c => ({
        hash: c.hash,
        originalMessage: c.message,
      }))

      for (let i = 0; i < commits.length; i++) {
        const commit = commits[i]
        const newMessage = await onGenerate(commit)
        generatedRewrites[i] = {
          hash: commit.hash,
          originalMessage: commit.message,
          newMessage,
        }
        // Update the UI
        render(React.createElement(App, { rewrites: generatedRewrites }))
      }
    })()
  })
}
