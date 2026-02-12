// Handle unhandled rejections in tests
// These come from oclif/core during module initialization in test environment
process.on('unhandledRejection', reason => {
  // Ignore oclif path errors in test environment
  if (reason instanceof Error && reason.message.includes('path argument') && reason.message.includes('undefined')) {
    return
  }
})

process.on('uncaughtException', error => {
  // Ignore oclif path errors in test environment
  if (error.message.includes('path argument') && error.message.includes('undefined')) {
    return
  }
  throw error
})
