import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'

interface CommitRewrite {
  hash: string
  originalMessage: string
  newMessage: string
}

interface Props {
  rewrites: CommitRewrite[]
}

export const CommitSelector: React.FC<Props> = ({ rewrites }) => {
  const [selected, setSelected] = useState<boolean[]>(
    rewrites.map(() => true) // Default: all selected
  )
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
      const selectedRewrites = rewrites.filter((_, i) => selected[i])
      // Print selected to stdout for parent process to read
      console.log('__SELECTED__:' + JSON.stringify(selectedRewrites))
      process.exit(0)
    } else if (input === 'c' || input === 'C' || key.escape) {
      process.exit(1)
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>Review Commit Messages</Text>
      <Text> </Text>

      {rewrites.map((rewrite, index) => (
        <Box key={rewrite.hash} flexDirection="column" marginBottom={1}>
          <Text>
            {selected[index] ? <Text color="cyan">●</Text> : <Text color="gray">○</Text>}
            {' '}
            <Text bold>{rewrite.hash.substring(0, 7)}</Text>
          </Text>
          <Box marginLeft={2} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
            <Text color="gray">old: {rewrite.originalMessage}</Text>
            <Text color="green">new: {rewrite.newMessage}</Text>
          </Box>
        </Box>
      ))}

      <Text> </Text>
      <Text dimColor>────────────────────────────────────────────</Text>
      <Text dimColor>[Space] Toggle  [a] Select All  [Enter] Apply</Text>
      <Text dimColor>[↑↓] Navigate  [c] Cancel</Text>
    </Box>
  )
}
