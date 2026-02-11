import { run } from '@oclif/core'

export async function main(_args: string[] = process.argv.slice(2)) {
  await run({
    development: process.env.NODE_ENV === 'development',
    version: process.env.VERSION || '0.0.0',
  })
}

if (process.argv[1]?.includes('git-reword')) {
  main()
}
