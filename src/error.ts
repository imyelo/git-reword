export enum ErrorCode {
  INVALID_ARGS = 1,
  CONFIG_ERROR = 2,
  GIT_ERROR = 3,
  USER_INTERRUPT = 4,
  PARTIAL_SUCCESS = 5,
}

export class GitRewordError extends Error {
  code: ErrorCode
  details?: unknown

  constructor(message: string, code: ErrorCode = ErrorCode.GIT_ERROR, details?: unknown) {
    super(message)
    this.name = 'GitRewordError'
    this.code = code
    this.details = details
  }
}

export function handleError(error: unknown): number {
  if (error instanceof GitRewordError) {
    console.error(`Error: ${error.message}`)
    if (error.details) {
      console.error(`Details: ${JSON.stringify(error.details)}`)
    }
    return error.code
  }

  if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
    return ErrorCode.GIT_ERROR
  }

  console.error('Unknown error occurred')
  return ErrorCode.GIT_ERROR
}
