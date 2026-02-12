import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function main(args: string[] = process.argv.slice(2)) {
  const { run } = await import('@oclif/core')
  await run(args, {
    dir: __dirname,
    devPlugins: process.env.NODE_ENV === 'development',
    version: process.env.VERSION || '0.0.0',
  } as never)
}

if (process.argv[1]?.includes('git-reword')) {
  main()
}
