import { Box, Text, useInput } from 'ink'
import type React from 'react'
import { useState } from 'react'

interface CommitRewrite {
  hash: string
  originalMessage: string
  newMessage?: string // Optional - may not be generated yet
}

interface Props {
  rewrites: CommitRewrite[]
}

export const CommitSelector: React.FC<Props> = ({ rewrites }) => {
  const [selected, setSelected] = useState<boolean[]>(rewrites.map(() => true))
  const [focusedIndex, setFocusedIndex] = useState(0)

  useInput((input, key) => {
    if (key.upArrow) {
      setFocusedIndex(i => Math.max(0, i - 1))
    } else if (key.downArrow) {
      setFocusedIndex(i => Math.min(rewrites.length - 1, i + 1))
    } else if (input === ' ') {
      const newSelected = [...selected]
      newSelected[focusedIndex] = !newSelected[focusedIndex]
      setSelected(newSelected)
    } else if (input === 'a' || input === 'A') {
      setSelected(rewrites.map(() => true))
    } else if (key.return) {
      // Only allow apply if all rewrites have newMessage
      const readyRewrites = rewrites.filter(r => r.newMessage)
      if (readyRewrites.length !== rewrites.length) {
        return // Don't exit if not all generated
      }
      const selectedRewrites = rewrites.filter((_, i) => selected[i] && rewrites[i].newMessage)
      console.log(`__SELECTED__:${JSON.stringify(selectedRewrites)}`)
      process.exit(0)
    } else if (input === 'c' || input === 'C' || key.escape) {
      process.exit(1)
    }
  })

  const isAllGenerated = rewrites.every(r => r.newMessage)

  return (
    <Box flexDirection="column">
      <Text bold>Review Commit Messages</Text>
      {!isAllGenerated && <Text dimColor>Generating new messages...</Text>}
      <Text> </Text>

      {rewrites.map((rewrite, index) => {
        const isFocused = index === focusedIndex
        const isSelected = selected[index]
        const isGenerated = !!rewrite.newMessage

        return (
          <Box
            key={rewrite.hash}
            flexDirection="column"
            marginBottom={1}
          >
            <Text>
              {isSelected ? <Text color="cyan">●</Text> : <Text color="gray">○</Text>}{' '}
              <Text bold>{rewrite.hash.substring(0, 7)}</Text>
              {!isGenerated && <Text dimColor> (generating...)</Text>}
            </Text>
            <Box
              marginLeft={2}
              flexDirection="column"
              borderStyle="round"
              borderColor={isFocused ? 'cyan' : 'gray'}
              paddingX={1}
              backgroundColor={isFocused ? 'cyan' : undefined}
            >
              <Text color={isFocused ? 'black' : 'gray'}>old: {rewrite.originalMessage}</Text>
              {isGenerated ? (
                <Text color={isFocused ? 'black' : 'green'}>new: {rewrite.newMessage}</Text>
              ) : (
                <Text
                  color="gray"
                  dimColor
                >
                  new: (generating...)
                </Text>
              )}
            </Box>
          </Box>
        )
      })}

      <Text> </Text>
      <Text dimColor>────────────────────────────────────────────</Text>
      <Text dimColor>[Space] Toggle [a] Select All {!isAllGenerated ? '' : '[Enter] Apply'}</Text>
      <Text dimColor>[↑↓] Navigate [c] Cancel</Text>
    </Box>
  )
}
