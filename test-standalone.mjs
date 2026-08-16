// test-standalone.mjs — drive CommandCodeAdapter.stream() directly, without a
// Cordis runtime, against the real CommandCode API. Requires:
//   COMMANDCODE_API_KEY=<user_...>
// Usage: node test-standalone.mjs [model]

import { CommandCodeAdapter } from './lib/adapter.js'
import { normalizeConfig } from './lib/config.js'

const model = process.argv[2] ?? 'deepseek/deepseek-v4-flash'
const config = normalizeConfig({
  apiKeyEnv: 'COMMANDCODE_API_KEY',
  baseURL: process.env.COMMANDCODE_API_BASE ?? 'https://api.commandcode.ai',
  models: [
    { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
    { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
  ],
})

const adapter = new CommandCodeAdapter({
  getConfig: () => config,
  resolveApiKey: async () => process.env.COMMANDCODE_API_KEY,
})

const chunks = []
let finished = null
try {
  for await (const chunk of adapter.stream({
    provider: 'commandcode',
    model,
    system: 'You are a connectivity test. Be extremely brief.',
    messages: [{
      id: 'msg-1',
      role: 'user',
      content: [{ type: 'text', text: 'Reply with exactly one line: HOLA-PLUGIN-TS-OK' }],
    }],
    signal: AbortSignal.timeout(120_000),
  })) {
    chunks.push(chunk)
    if (chunk.type === 'finish') finished = chunk.reason
  }
} catch (error) {
  console.error('STREAM ERROR:', error?.message ?? error)
  process.exit(1)
}

console.log('---')
console.log('chunks:', chunks.length)
console.log('finish:', JSON.stringify(finished))
const text = chunks.filter((c) => c.type === 'text-delta').map((c) => c.text).join('')
console.log('assembled text:', JSON.stringify(text))
const usage = chunks.find((c) => c.type === 'usage')
console.log('usage:', JSON.stringify(usage?.usage ?? null))
process.exit(0)
