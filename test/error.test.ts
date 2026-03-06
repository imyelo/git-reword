import { describe, expect, it, vi } from 'vitest'
import { ErrorCode, GitRewordError, handleError } from '../src/error'

// Mock console.error to test output
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('error handling', () => {
  describe('handleError', () => {
    it('should return CONFIG_ERROR for config errors', () => {
      const error = new GitRewordError('config error', ErrorCode.CONFIG_ERROR)
      expect(handleError(error)).toBe(ErrorCode.CONFIG_ERROR)
    })

    it('should return INVALID_ARGS for invalid argument errors', () => {
      const error = new GitRewordError('invalid args', ErrorCode.INVALID_ARGS)
      expect(handleError(error)).toBe(ErrorCode.INVALID_ARGS)
    })

    it('should return GIT_ERROR for git errors', () => {
      const error = new GitRewordError('git error', ErrorCode.GIT_ERROR)
      expect(handleError(error)).toBe(ErrorCode.GIT_ERROR)
    })

    it('should return USER_INTERRUPT for user interrupt errors', () => {
      const error = new GitRewordError('user interrupt', ErrorCode.USER_INTERRUPT)
      expect(handleError(error)).toBe(ErrorCode.USER_INTERRUPT)
    })

    it('should return GIT_ERROR for unknown errors', () => {
      const error = new Error('unknown error')
      expect(handleError(error)).toBe(ErrorCode.GIT_ERROR)
    })

    it('should return GIT_ERROR for non-error values', () => {
      expect(handleError('string error')).toBe(ErrorCode.GIT_ERROR)
      expect(handleError(null)).toBe(ErrorCode.GIT_ERROR)
      expect(handleError(undefined)).toBe(ErrorCode.GIT_ERROR)
    })
  })

  describe('GitRewordError', () => {
    it('should set code and message correctly', () => {
      const error = new GitRewordError('test message', ErrorCode.CONFIG_ERROR, { detail: 'extra' })
      expect(error.message).toBe('test message')
      expect(error.code).toBe(ErrorCode.CONFIG_ERROR)
      expect(error.details).toEqual({ detail: 'extra' })
    })

    it('should default to GIT_ERROR when code not specified', () => {
      const error = new GitRewordError('test message')
      expect(error.code).toBe(ErrorCode.GIT_ERROR)
    })
  })
})
