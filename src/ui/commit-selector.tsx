import { Box, Text, useInput } from 'ink'
import type React from 'react'
import { useEffect, useState } from 'react'

interface CommitRewrite {
  hash: string
  originalMessage: string
  originalBody?: string
  newMessage?: string // Optional - may not be generated yet
  newBody?: string
}

interface Props {
  rewrites: CommitRewrite[]
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPINNER_INTERVAL = 80

export const CommitSelector: React.FC<Props> = ({ rewrites }) => {
  const [selected, setSelected] = useState<boolean[]>(rewrites.map(() => true))
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)

  // Spinner animation
  useEffect(() => {
    if (!rewrites.every(r => r.newMessage)) {
      const interval = setInterval(() => {
        setSpinnerFrame(f => (f + 1) % SPINNER_FRAMES.length)
      }, SPINNER_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [rewrites])

  useInput((input, key) => {
    if (key.upArrow) {
      setFocusedIndex(i => Math.max(0, i - 1))
    } else if (key.downArrow) {
      setFocusedIndex(i => Math.min(rewrites.length - 1, i + 1))
    } else if (key.pageUp) {
      setFocusedIndex(i => Math.max(0, i - 5))
    } else if (key.pageDown) {
      setFocusedIndex(i => Math.min(rewrites.length - 1, i + 5))
    } else if (key.home) {
      setFocusedIndex(0)
    } else if (key.end) {
      setFocusedIndex(rewrites.length - 1)
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
    } else if (input === 'c' || input === 'C' || input === 'q' || input === 'Q' || key.escape) {
      process.exit(1)
    }
  })

  const isAllGenerated = rewrites.every(r => r.newMessage)
  const selectedCount = selected.filter(Boolean).length

  return (
    <Box flexDirection="column">
      <Text bold>Review Commit Messages</Text>
      <Text dimColor>
        {selectedCount}/{rewrites.length} selected
      </Text>
      {!isAllGenerated && <Text dimColor>Generating... {SPINNER_FRAMES[spinnerFrame]}</Text>}
      <Text> </Text>

      {rewrites.map((rewrite, index) => {
        const isFocused = index === focusedIndex
        const isSelected = selected[index]
        const isGenerated = !!rewrite.newMessage

        // Dim unselected commits
        const dimmed = !isSelected
        const _baseColor = dimmed ? 'gray' : isFocused ? 'black' : 'white'
        const mutedColor = dimmed ? 'gray' : isFocused ? 'black' : 'gray'

        return (
          <Box
            key={rewrite.hash}
            flexDirection="column"
            marginBottom={1}
            opacity={dimmed ? 0.5 : 1}
          >
            <Text>
              {isSelected ? <Text color="cyan">●</Text> : <Text color="gray">○</Text>}{' '}
              <Text bold>{rewrite.hash.substring(0, 7)}</Text>
              {!isGenerated && <Text dimColor> (generating...)</Text>}
              {isGenerated && !isSelected && <Text dimColor> (keep old)</Text>}
            </Text>
            <Box
              marginLeft={2}
              flexDirection="column"
              borderStyle="round"
              borderColor={isFocused ? 'cyan' : dimmed ? 'black' : 'gray'}
              paddingX={1}
              backgroundColor={isFocused ? 'cyan' : undefined}
            >
              <Text color={mutedColor}>old: {rewrite.originalMessage}</Text>
              {rewrite.originalBody && (
                <Text
                  color={mutedColor}
                  dimColor
                >
                  {rewrite.originalBody}
                </Text>
              )}
              {isGenerated ? (
                <Box flexDirection="column">
                  <Text
                    color={isSelected ? 'green' : 'gray'}
                    bold={isSelected}
                  >
                    new: {rewrite.newMessage}
                  </Text>
                  {rewrite.newBody && (
                    <Text
                      color={isSelected ? 'green' : 'gray'}
                      dimColor={!isSelected}
                    >
                      {rewrite.newBody}
                    </Text>
                  )}
                </Box>
              ) : (
                <Text
                  color="gray"
                  dimColor
                >
                  {SPINNER_FRAMES[spinnerFrame]} new: (generating...)
                </Text>
              )}
            </Box>
          </Box>
        )
      })}

      <Text> </Text>
      <Text dimColor>────────────────────────────────────────────</Text>
      <Text dimColor>[Space] Toggle [a] Select All {!isAllGenerated ? '' : '[Enter] Apply'}</Text>
      <Text dimColor>[↑↓/PgUp/PgDn] Navigate [Q] Quit</Text>
    </Box>
  )
}
