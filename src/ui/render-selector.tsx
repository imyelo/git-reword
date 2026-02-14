import { render } from 'ink'
import React from 'react'
import { CommitSelector } from './commit-selector.js'

interface CommitRewrite {
  hash: string
  originalMessage: string
  originalBody?: string
  newMessage?: string
  newBody?: string
}

interface AppProps {
  rewrites: CommitRewrite[]
  onSubmit?: (results: CommitRewrite[]) => void
  onCancel?: () => void
}

const App: React.FC<AppProps> = ({ rewrites, onSubmit, onCancel }) => {
  return (
    <CommitSelector
      rewrites={rewrites}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  )
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
  commits: Array<{ hash: string; message: string; body?: string }>,
  onGenerate: (commit: { hash: string; message: string }) => Promise<{ message: string; body: string }>
): Promise<Array<{
  hash: string
  originalMessage: string
  originalBody?: string
  newMessage: string
  newBody: string
}> | null> {
  // Initialize with all commits (no newMessage yet)
  const rewrites: CommitRewrite[] = commits.map(c => ({
    hash: c.hash,
    originalMessage: c.message,
    originalBody: c.body,
  }))

  return new Promise(resolve => {
    const handleSubmit = (results: CommitRewrite[]) => {
      unmount()
      resolve(
        results as Array<{
          hash: string
          originalMessage: string
          originalBody?: string
          newMessage: string
          newBody: string
        }>
      )
    }

    const handleCancel = () => {
      unmount()
      resolve(null)
    }

    // Render with initial state
    const { rerender, unmount } = render(
      React.createElement(App, { rewrites, onSubmit: handleSubmit, onCancel: handleCancel })
    )

    // Generate new messages serially, updating UI after each
    ;(async () => {
      const generatedRewrites: CommitRewrite[] = commits.map(c => ({
        hash: c.hash,
        originalMessage: c.message,
        originalBody: c.body,
      }))

      for (let i = 0; i < commits.length; i++) {
        const commit = commits[i]
        const result = await onGenerate(commit)
        generatedRewrites[i] = {
          hash: commit.hash,
          originalMessage: commit.message,
          originalBody: commit.body,
          newMessage: result.message,
          newBody: result.body,
        }
        // Update the UI
        rerender(
          React.createElement(App, {
            rewrites: generatedRewrites,
            onSubmit: handleSubmit,
            onCancel: handleCancel,
          })
        )
      }
    })()
  })
}
