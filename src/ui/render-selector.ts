import { render } from 'ink'
import React from 'react'
import { CommitSelector } from './commit-selector.js'

interface CommitRewrite {
  hash: string
  originalMessage: string
  newMessage: string
}

export async function selectCommits(rewrites: CommitRewrite[]): Promise<CommitRewrite[] | null> {
  return new Promise(resolve => {
    // Render ink component to a virtual DOM
    const { unmount } = render(React.createElement(CommitSelector, { rewrites }))

    // Listen for output from the component (via console.log)
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

    // Handle process exit from component
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
  })
}
