import { Box, Text, useInput, useStdout } from 'ink'
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
  onSubmit?: (results: CommitRewrite[]) => void
  onCancel?: () => void
}

type Version = 'old' | 'new'
type UIMode = 'select' | 'confirm'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPINNER_INTERVAL = 80
const MULTILINE_ICON = ' ↕'
const HASH_WIDTH = 11

// ─── Message Cell ──────────────────────────────────────────────────
const MessageCell: React.FC<{
  message: string
  body?: string
  isExpanded: boolean
  isFocused: boolean
  isSelected: boolean
  isLoading: boolean
  spinnerFrame: number
}> = ({ message, body, isExpanded, isFocused, isSelected, isLoading, spinnerFrame }) => {
  const hasMultiline = !!body

  if (isLoading) {
    return (
      <Box
        flexGrow={1}
        flexBasis={0}
        paddingX={1}
      >
        <Text dimColor>{SPINNER_FRAMES[spinnerFrame]} generating…</Text>
      </Box>
    )
  }

  return (
    <Box
      flexGrow={1}
      flexBasis={0}
      flexDirection="column"
      paddingX={1}
      {...(isFocused ? { backgroundColor: '#333333' } : {})}
    >
      <Text
        color={isSelected ? 'magenta' : 'white'}
        bold={isSelected}
      >
        {message}
        {hasMultiline && !isExpanded && <Text dimColor>{MULTILINE_ICON}</Text>}
      </Text>
      {isExpanded && body && (
        <Text
          color={isSelected ? 'magenta' : 'white'}
          dimColor
        >
          {body}
        </Text>
      )}
    </Box>
  )
}

// ─── Commit Row ────────────────────────────────────────────────────
const CommitRow: React.FC<{
  rewrite: CommitRewrite
  isFocused: boolean
  focusedColumn: Version
  selectedVersion: Version
  spinnerFrame: number
  col2Width: number
  col3Width: number
}> = ({ rewrite, isFocused, focusedColumn, selectedVersion, spinnerFrame, col2Width, col3Width }) => {
  const isGenerated = !!rewrite.newMessage

  return (
    <Box flexDirection="row">
      {/* Hash column */}
      <Box
        borderStyle="bold"
        borderLeft={true}
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        width={HASH_WIDTH + 1}
        flexShrink={0}
      >
        <Box
          width={HASH_WIDTH}
          paddingX={1}
          flexShrink={0}
        >
          <Text
            bold
            color={isFocused ? 'cyan' : 'white'}
          >
            {rewrite.hash.substring(0, 7)}
          </Text>
        </Box>
      </Box>

      {/* New message column */}
      <Box
        borderStyle="bold"
        borderLeft={true}
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        borderColor="gray"
        width={col2Width + 1}
        flexShrink={0}
      >
        <MessageCell
          width={col2Width}
          message={isGenerated ? (rewrite.newMessage ?? '') : ''}
          body={isGenerated ? rewrite.newBody : undefined}
          isExpanded={isFocused}
          isFocused={isFocused && focusedColumn === 'new' && isGenerated}
          isSelected={selectedVersion === 'new'}
          isLoading={!isGenerated}
          spinnerFrame={spinnerFrame}
        />
      </Box>

      {/* Old message column */}
      <Box
        borderStyle="bold"
        borderLeft={true}
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        borderColor="gray"
        width={col3Width + 1}
        flexShrink={0}
      >
        <MessageCell
          width={col3Width}
          message={rewrite.originalMessage}
          body={rewrite.originalBody}
          isExpanded={isFocused}
          isFocused={isFocused && focusedColumn === 'old'}
          isSelected={selectedVersion === 'old'}
          isLoading={false}
          spinnerFrame={spinnerFrame}
        />
      </Box>

      {/* Outer right border */}
      <Box
        borderStyle="bold"
        borderLeft={true}
        borderRight={false}
        borderTop={false}
        borderBottom={false}
      />
    </Box>
  )
}

// ─── Hotkey Label ──────────────────────────────────────────────────
const HotkeyLabel: React.FC<{
  keyName: string
  label: string
  enabled?: boolean
}> = ({ keyName, label, enabled = true }) => (
  <Box marginRight={2}>
    <Text>
      <Text
        color={enabled ? 'cyan' : undefined}
        dimColor={!enabled}
        bold={enabled}
      >
        {keyName}
      </Text>
      <Text dimColor={!enabled}> {label}</Text>
    </Text>
  </Box>
)

// ─── Confirm Bar ───────────────────────────────────────────────────
const ConfirmBar: React.FC<{
  confirmFocused: boolean
}> = ({ confirmFocused }) => (
  <Box gap={2}>
    <Text
      bold
      color="yellow"
    >
      Apply changes?
    </Text>
    <Box gap={2}>
      <Text
        bold={confirmFocused}
        color={confirmFocused ? 'green' : undefined}
        dimColor={!confirmFocused}
      >
        {confirmFocused ? '▸ ' : '  '}Confirm <Text dimColor>(Y)</Text>
      </Text>
      <Text
        bold={!confirmFocused}
        color={!confirmFocused ? 'red' : undefined}
        dimColor={confirmFocused}
      >
        {!confirmFocused ? '▸ ' : '  '}Cancel <Text dimColor>(N)</Text>
      </Text>
    </Box>
  </Box>
)

// ─── Main Selector ─────────────────────────────────────────────────
export const CommitSelector: React.FC<Props> = ({ rewrites, onSubmit, onCancel }) => {
  const { stdout } = useStdout()
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [focusedColumn, setFocusedColumn] = useState<Version>('new')
  const [selectedVersions, setSelectedVersions] = useState<Version[]>(() => rewrites.map(() => 'new'))
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [uiMode, setUiMode] = useState<UIMode>('select')
  const [confirmFocused, setConfirmFocused] = useState(true) // true = Confirm, false = Cancel

  // Set up dynamic column widths
  const [columns, setColumns] = useState(stdout?.columns || 80)

  useEffect(() => {
    if (!stdout) {
      return
    }
    const onResize = () => setColumns(stdout.columns)
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  // Track which commits have already been auto-switched to 'new'
  const autoSwitchedRef = useRef<Set<number>>(new Set())

  // Auto-switch to 'new' version when newMessage arrives
  useEffect(() => {
    setSelectedVersions(prev => {
      const next = [...prev]
      let changed = false
      for (let i = 0; i < rewrites.length; i++) {
        if (rewrites[i].newMessage && !autoSwitchedRef.current.has(i)) {
          autoSwitchedRef.current.add(i)
          if (next[i] === 'old') {
            next[i] = 'new'
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [rewrites])

  // Spinner animation
  useEffect(() => {
    if (!rewrites.every(r => r.newMessage)) {
      const interval = setInterval(() => {
        setSpinnerFrame(f => (f + 1) % SPINNER_FRAMES.length)
      }, SPINNER_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [rewrites])

  const isAllGenerated = rewrites.every(r => r.newMessage)

  const moveFocus = (newIndex: number) => {
    setFocusedIndex(newIndex)
  }

  useInput((input, key) => {
    // ── Confirm mode ──
    if (uiMode === 'confirm') {
      if (key.leftArrow || key.rightArrow || key.tab) {
        setConfirmFocused(prev => !prev)
      } else if (key.return || input === 'y' || input === 'Y') {
        if (confirmFocused || input === 'y' || input === 'Y') {
          // Confirm: submit results
          const results = rewrites.map((r, i) => {
            const version = selectedVersions[i]
            return {
              hash: r.hash,
              originalMessage: r.originalMessage,
              originalBody: r.originalBody,
              newMessage: version === 'new' ? (r.newMessage ?? r.originalMessage) : r.originalMessage,
              newBody: version === 'new' ? (r.newBody ?? '') : (r.originalBody ?? ''),
            }
          })
          onSubmit?.(results)
        } else {
          // Cancel: return to select mode
          setUiMode('select')
        }
      } else if (input === 'n' || input === 'N' || key.escape) {
        setUiMode('select')
      }
      return
    }

    // ── Select mode ──
    if (key.upArrow) {
      moveFocus(Math.max(0, focusedIndex - 1))
    } else if (key.downArrow) {
      moveFocus(Math.min(rewrites.length - 1, focusedIndex + 1))
    } else if (key.leftArrow) {
      if (rewrites[focusedIndex].newMessage) {
        setFocusedColumn('new')
      }
    } else if (key.rightArrow) {
      setFocusedColumn('old')
    } else if (input === ' ') {
      if (focusedColumn === 'new' && !rewrites[focusedIndex].newMessage) {
        return
      }
      const newVersions = [...selectedVersions]
      newVersions[focusedIndex] = focusedColumn
      setSelectedVersions(newVersions)
    } else if (key.return) {
      if (!isAllGenerated) {
        return
      }
      setConfirmFocused(true)
      setUiMode('confirm')
    } else if (input === 'q' || input === 'Q' || key.escape) {
      onCancel?.()
    }
  })

  // Viewport calculations have been removed in favor of dynamic shrinking.

  const selectedNewCount = selectedVersions.filter(v => v === 'new').length
  const generatedCount = rewrites.filter(r => r.newMessage).length

  // Calculate table sections
  const bordersWidth = 4 // Left, Right, 2 inner vertical rules
  const fillableWidth = Math.max(10, columns - HASH_WIDTH - bordersWidth)
  const col2Width = Math.floor(fillableWidth / 2)
  const col3Width = fillableWidth - col2Width

  const topBorder = `┏${'━'.repeat(HASH_WIDTH)}┳${'━'.repeat(col2Width)}┳${'━'.repeat(col3Width)}┓`
  const sepBorder = `┣${'━'.repeat(HASH_WIDTH)}╋${'━'.repeat(col2Width)}╋${'━'.repeat(col3Width)}┫`
  const botBorder = `┗${'━'.repeat(HASH_WIDTH)}┻${'━'.repeat(col2Width)}┻${'━'.repeat(col3Width)}┛`

  return (
    <Box
      flexDirection="column"
      flex={1}
    >
      <Text bold>Review Commit Messages</Text>
      <Text> </Text>

      {/* Table with perfectly styled border strings */}
      <Box flexDirection="column">
        {/* Top Border */}
        <Text>{topBorder}</Text>

        {/* Header row */}
        <Box flexDirection="row">
          <Box
            borderStyle="bold"
            borderLeft={true}
            borderRight={false}
            borderTop={false}
            borderBottom={false}
            width={HASH_WIDTH + 1}
            flexShrink={0}
          >
            <Box
              width={HASH_WIDTH}
              paddingX={1}
              flexShrink={0}
            >
              <Text
                bold
                dimColor
              >
                hash
              </Text>
            </Box>
          </Box>
          <Box
            borderStyle="bold"
            borderLeft={true}
            borderRight={false}
            borderTop={false}
            borderBottom={false}
            width={col2Width + 1}
            flexShrink={0}
          >
            <Box
              width={col2Width}
              paddingX={1}
            >
              <Text dimColor>suggested</Text>
            </Box>
          </Box>
          <Box
            borderStyle="bold"
            borderLeft={true}
            borderRight={false}
            borderTop={false}
            borderBottom={false}
            width={col3Width + 1}
            flexShrink={0}
          >
            <Box
              width={col3Width}
              paddingX={1}
            >
              <Text dimColor>original</Text>
            </Box>
          </Box>
          <Box
            borderStyle="bold"
            borderLeft={true}
            borderRight={false}
            borderTop={false}
            borderBottom={false}
          />
        </Box>

        {/* Middle Separator */}
        <Text>{sepBorder}</Text>

        {/* Commit rows */}
        <Box flexDirection="column">
          {rewrites.map((rewrite, index) => (
            <CommitRow
              key={rewrite.hash}
              rewrite={rewrite}
              isFocused={index === focusedIndex}
              focusedColumn={focusedColumn}
              selectedVersion={selectedVersions[index]}
              spinnerFrame={spinnerFrame}
              col2Width={col2Width}
              col3Width={col3Width}
            />
          ))}
        </Box>

        {/* Bottom Border */}
        <Text>{botBorder}</Text>
      </Box>

      {/* Status bar */}
      <Text>
        {!isAllGenerated && (
          <Text dimColor>
            {SPINNER_FRAMES[spinnerFrame]} {generatedCount}/{rewrites.length} generated
            {'  '}
          </Text>
        )}
        <Text color="cyan">{selectedNewCount}</Text>
        <Text>/{rewrites.length} suggestions selected</Text>
      </Text>

      {/* Bottom bar: hotkeys or confirm dialog */}
      {uiMode === 'confirm' ? (
        <ConfirmBar confirmFocused={confirmFocused} />
      ) : (
        <Box>
          <HotkeyLabel
            keyName="↑↓"
            label="Navigate"
          />
          <HotkeyLabel
            keyName="←→"
            label="Switch"
          />
          <HotkeyLabel
            keyName="Space"
            label="Select"
          />
          <HotkeyLabel
            keyName="Enter"
            label="Apply Changes"
            enabled={isAllGenerated}
          />
          <HotkeyLabel
            keyName="Q"
            label="Quit without saving"
          />
        </Box>
      )}
    </Box>
  )
}
