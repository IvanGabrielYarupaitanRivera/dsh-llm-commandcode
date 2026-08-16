// config.ts — schema and normalization for the llm-commandcode plugin.
//
// The schemastery `Config` schema drives composition (cordis.yml) and the
// user-settings document (the `llm-commandcode:` section). normalizeConfig()
// turns any raw object into the validated facts the adapter reads per request.

import z from '@deepseek-ai/schemastery'
import { resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { CommandCodeConfig, CommandCodeModelEntry, RawCommandCodeConfig } from './types.js'

/** Model ids used by the CommandCode proxy, as observed on the wire. */
const schemaDefaultModels = [
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', contextWindow: 131072, maxTokens: 8192 },
  { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', contextWindow: 131072, maxTokens: 8192 },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', contextWindow: 200000, maxTokens: 16384 },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', contextWindow: 200000, maxTokens: 16384 },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', contextWindow: 1000000, maxTokens: 32768 },
]

const model = z.object({
  id: z.string().required(),
  name: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
})

export const Config: z<RawCommandCodeConfig> = z.object({
  /** Credential reference for the CommandCode API key (`user_...`). */
  apiKeyEnv: z.string().role('credential-ref'),
  /** Provider route display name shown in selectors. */
  displayName: z.string().default('Command Code'),
  /** CommandCode API base; the adapter appends /alpha/generate. */
  baseURL: z.string().default('https://api.commandcode.ai'),
  /** Catalog served by listModels(); empty keeps no advertised models. */
  models: z.array(model).default(schemaDefaultModels),
  defaultContextWindow: z.number().step(1).min(1).default(262144),
  defaultMaxTokens: z.number().step(1).min(1).default(32768),
  /** Deployment default effort: off | high | max (omitted ⇒ high). */
  reasoningEffort: z.union(['off', 'high', 'max']),
  /** effort → budget_tokens for the CommandCode `thinking` parameter. */
  thinkingBudgets: z.dict(z.number().step(1).min(1)).default({ high: 2048, max: 8192 }),
  /** Extra headers merged into every provider request (plain strings). */
  headers: z.dict(z.string()).default({}),
  /** Bounds one outstanding provider read; five-minute default. */
  streamIdleTimeoutMs: z.number().step(1).min(1).default(300000),
  retryPolicy: RetryPolicySchema,
})

const REASONING_EFFORTS = new Set<string>(['off', 'high', 'max'])

/**
 * Validate a raw configuration object and produce the facts the adapter reads.
 * Throws on values the adapter cannot serve; never silently fixes them.
 */
export function normalizeConfig(raw: RawCommandCodeConfig = {}): CommandCodeConfig {
  const config: CommandCodeConfig = {
    apiKeyEnv: raw.apiKeyEnv ?? 'COMMANDCODE_API_KEY',
    displayName: raw.displayName ?? 'Command Code',
    baseURL: String(raw.baseURL ?? 'https://api.commandcode.ai').replace(/\/+$/, ''),
    models: raw.models !== undefined ? [...raw.models] : [...schemaDefaultModels],
    defaultContextWindow: raw.defaultContextWindow ?? 262144,
    defaultMaxTokens: raw.defaultMaxTokens ?? 32768,
    reasoningEffort: raw.reasoningEffort,
    thinkingBudgets: { ...(raw.thinkingBudgets ?? { high: 2048, max: 8192 }) },
    headers: { ...(raw.headers ?? {}) },
    streamIdleTimeoutMs: raw.streamIdleTimeoutMs ?? 300000,
    retryPolicy: raw.retryPolicy !== undefined ? resolveRetryPolicy(raw.retryPolicy, 'llm-commandcode.retryPolicy') : undefined,
  }
  if (config.reasoningEffort !== undefined && !REASONING_EFFORTS.has(config.reasoningEffort)) {
    throw new Error(
      `llm-commandcode: reasoningEffort must be one of off, high, max (got "${config.reasoningEffort}")`,
    )
  }
  const seen = new Set<string>()
  config.models = config.models.filter((entry) => {
    if (entry.id.length === 0 || seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })
  return config
}
