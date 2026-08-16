// serialize.ts — the CommandCode request envelope and headers.
//
// The CommandCode Provider API wraps an OpenAI-like `params` block in a
// proprietary envelope. Every value here is kept byte-stable so the proxy can
// reuse prefix caches across turns.

import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import type { CcMessage, CcTool } from './types.js'

export const COMMANDCODE_CLI_VERSION = '0.40.11'

/** Frozen config object: no dynamic metadata, so request prefixes stay stable. */
export const STATIC_CONFIG = {
  workingDir: '/project',
  date: '2026-01-01',
  environment: 'dsh-llm-commandcode',
  structure: [],
  isGitRepo: false,
  currentBranch: '',
  mainBranch: '',
  gitStatus: '',
  recentCommits: [],
} as const

/** Headers every provider request sends. extra merges user-configured headers. */
export function buildHeaders(
  apiKey: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
    'x-command-code-version': COMMANDCODE_CLI_VERSION,
    'x-cli-environment': 'production',
    'x-project-slug': 'dsh-commandcode',
    'x-taste-learning': 'false',
    'x-co-flag': 'false',
    'x-bypass-transform': 'true',
    'x-raw-payload': 'true',
    ...attributionHeaders(),
    ...extra,
  }
}

export interface BuildBodyOptions {
  model: string
  messages: CcMessage[]
  tools: readonly CcTool[]
  system: string
  maxTokens: number
  temperature?: number
  thinking?: { type: 'enabled'; budget_tokens: number }
  threadId: string
}

/** Build the full /alpha/generate request body. */
export function buildBody(options: BuildBodyOptions): Record<string, unknown> {
  const params: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    tools: options.tools,
    system: options.system,
    max_tokens: options.maxTokens,
    temperature: options.temperature ?? 0.3,
    stream: true,
  }
  if (options.thinking !== undefined) params.thinking = options.thinking
  return {
    config: STATIC_CONFIG,
    memory: null,
    taste: null,
    skills: null,
    cache_prompt: true,
    disable_backend_formatting: true,
    params,
    threadId: options.threadId,
  }
}

/** JSON with sorted keys, so equal payloads serialize byte-identically. */
export function deterministicStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(deterministicStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${deterministicStringify(record[key])}`).join(',')}}`
}
