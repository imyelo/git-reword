import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.js'],
    environment: 'node',
    onUnhandledReject: 'warn',
    exclude: ['**/.worktrees/**', '**/node_modules/**'],
  },
})
