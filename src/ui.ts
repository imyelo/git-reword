import { createInterface } from 'node:readline'

export async function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close()
      resolve(answer.toLowerCase().startsWith('y'))
    })
  })
}
