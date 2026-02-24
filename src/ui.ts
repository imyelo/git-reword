import { createInterface } from 'node:readline'

export async function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    const ask = (): void => {
      rl.question(prompt, answer => {
        const trimmed = answer.trim().toLowerCase()
        if (trimmed === '' || trimmed === 'y' || trimmed.startsWith('y')) {
          rl.close()
          resolve(true)
        } else if (trimmed === 'n') {
          rl.close()
          resolve(false)
        } else {
          // Invalid input, ask again
          ask()
        }
      })
    }
    ask()
  })
}
