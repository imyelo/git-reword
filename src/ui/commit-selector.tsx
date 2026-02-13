import { ScrollBarBox } from '@byteland/ink-scroll-bar'
import { Box, Text, useInput, useStdout } from 'ink'
import type { ScrollViewRef } from 'ink-scroll-view'
import { ScrollView } from 'ink-scroll-view'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'

interface CommitRewrite {
  hash: string
  originalMessage: string
  originalBody?: string
  newMessage?: string
  newBody?: string
}

interface Props {
  rewrites: CommitRewrite[]
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPINNER_INTERVAL = 80

const CommitItem: React.FC<{
  rewrite: CommitRewrite
  isFocused: boolean
  isSelected: boolean
  spinnerFrame: number
}> = ({ rewrite, isFocused, isSelected, spinnerFrame }) => {
  const isGenerated = !!rewrite.newMessage

  // Focused: full display
  if (isFocused) {
    return (
      <Box
        flexDirection="column"
        marginBottom={1}
        opacity={isSelected ? 1 : 0.5}
      >
        <Text>
          {isSelected ? <Text color="cyan">●</Text> : <Text color="gray">○</Text>}{' '}
          <Text bold>{rewrite.hash.substring(0, 7)}</Text>
          {!isGenerated && <Text dimColor> {SPINNER_FRAMES[spinnerFrame]} generating...</Text>}
          {isGenerated && !isSelected && <Text dimColor> (keep old)</Text>}
        </Text>
        <Box
          marginLeft={2}
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          backgroundColor="cyan"
        >
          <Text color="black">old: {rewrite.originalMessage}</Text>
          {rewrite.originalBody && (
            <Text
              color="black"
              dimColor
            >
              {rewrite.originalBody}
            </Text>
          )}
          {isGenerated ? (
            <Box flexDirection="column">
              <Text
                color="green"
                bold
              >
                new: {rewrite.newMessage}
              </Text>
              {rewrite.newBody && (
                <Text
                  color="green"
                  dimColor
                >
                  {rewrite.newBody}
                </Text>
              )}
            </Box>
          ) : (
            <Text
              color="black"
              dimColor
            >
              {SPINNER_FRAMES[spinnerFrame]} new: (generating...)
            </Text>
          )}
        </Box>
      </Box>
    )
  }

  // Unfocused: collapsed display
  return (
    <Box
      marginBottom={1}
      opacity={isSelected ? 0.8 : 0.4}
    >
      <Text>
        {isSelected ? <Text color="cyan">●</Text> : <Text color="gray">○</Text>}{' '}
        <Text bold>{rewrite.hash.substring(0, 7)}</Text>
        <Text dimColor> {rewrite.originalMessage}</Text>
        {!isGenerated && <Text dimColor> {SPINNER_FRAMES[spinnerFrame]}</Text>}
        {isGenerated && !isSelected && <Text dimColor> (keep)</Text>}
      </Text>
    </Box>
  )
}

export const CommitSelector: React.FC<Props> = ({ rewrites }) => {
  const { stdout } = useStdout()
  const scrollRef = useRef<ScrollViewRef>(null)
  const [selected, setSelected] = useState<boolean[]>(rewrites.map(() => true))
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)

  // Calculate viewport height from terminal
  const headerLines = 8 // Title, blank, scrollbar borders, divider, status, help, blank
  const viewportHeight = Math.max(5, (stdout?.rows || 24) - headerLines)

  // Spinner animation
  useEffect(() => {
    if (!rewrites.every(r => r.newMessage)) {
      const interval = setInterval(() => {
        setSpinnerFrame(f => (f + 1) % SPINNER_FRAMES.length)
      }, SPINNER_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [rewrites])

  // Scroll to show focused item (expanded) in viewport
  const scrollToItem = (index: number, direction: 'up' | 'down' | 'unknown') => {
    // Get current scroll state
    const currentScroll = scrollRef.current?.getScrollOffset() ?? 0
    const contentHeight = scrollRef.current?.getContentHeight() ?? 0
    const vpHeight = viewportHeight

    // Focused item expands to ~8 lines when focused
    // Estimate position: focused item is at index, each item ~6 lines when expanded
    const focusedItemTop = index * 6

    // Check what's currently visible: focused item spans from focusedItemTop to focusedItemTop + 8
    const focusedItemBottom = focusedItemTop + 8
    const currentBottom = currentScroll + vpHeight

    // Is focused item fully visible?
    const fullyVisible = focusedItemTop >= currentScroll && focusedItemBottom <= currentBottom

    if (fullyVisible) {
      return
    }

    let targetOffset: number

    if (direction === 'down') {
      // Scroll down: show at bottom (item bottom aligns with viewport bottom)
      targetOffset = focusedItemBottom - vpHeight
    } else {
      // Scroll up or unknown: show at top
      targetOffset = focusedItemTop
    }

    // Clamp to valid range
    targetOffset = Math.max(0, Math.min(targetOffset, Math.max(0, contentHeight - vpHeight)))

    scrollRef.current?.scrollTo(targetOffset)
  }

  useInput((input, key) => {
    if (key.upArrow) {
      const newIndex = Math.max(0, focusedIndex - 1)
      setFocusedIndex(newIndex)
      scrollToItem(newIndex, 'up')
    } else if (key.downArrow) {
      const newIndex = Math.min(rewrites.length - 1, focusedIndex + 1)
      setFocusedIndex(newIndex)
      scrollToItem(newIndex, 'down')
    } else if (key.home) {
      setFocusedIndex(0)
      scrollRef.current?.scrollToTop()
    } else if (key.end) {
      setFocusedIndex(rewrites.length - 1)
      scrollRef.current?.scrollToBottom()
    } else if (input === ' ') {
      const newSelected = [...selected]
      newSelected[focusedIndex] = !newSelected[focusedIndex]
      setSelected(newSelected)
    } else if (input === 'a' || input === 'A') {
      setSelected(rewrites.map(() => true))
    } else if (key.return) {
      const readyRewrites = rewrites.filter(r => r.newMessage)
      if (readyRewrites.length !== rewrites.length) {
        return
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
    <Box
      flexDirection="column"
      flex={1}
    >
      <Text bold>Review Commit Messages</Text>
      <Text> </Text>

      <ScrollBarBox
        borderStyle="round"
        borderColor="gray"
        height={viewportHeight}
        contentHeight={rewrites.length * 6}
        viewportHeight={viewportHeight}
        scrollOffset={scrollOffset}
        scrollBarPosition="right"
        scrollBarAutoHide
      >
        <ScrollView
          ref={scrollRef}
          onScroll={offset => setScrollOffset(offset)}
        >
          {rewrites.map((rewrite, index) => (
            <CommitItem
              key={rewrite.hash}
              rewrite={rewrite}
              isFocused={index === focusedIndex}
              isSelected={selected[index]}
              spinnerFrame={spinnerFrame}
            />
          ))}
        </ScrollView>
      </ScrollBarBox>

      <Text> </Text>
      <Text dimColor>────────────────────────────────────────────</Text>
      <Text>
        <Text color="cyan">{selectedCount}</Text>
        <Text>/{rewrites.length} selected</Text>
        {!isAllGenerated && <Text dimColor> {SPINNER_FRAMES[spinnerFrame]} generating...</Text>}
      </Text>
      <Text dimColor>[Space] Toggle [a] Select All {!isAllGenerated ? '' : '[Enter] Apply'}</Text>
      <Text dimColor>[↑↓] Navigate [Q] Quit</Text>
    </Box>
  )
}
