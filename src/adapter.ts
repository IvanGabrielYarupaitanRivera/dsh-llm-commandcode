// adapter.ts — the CommandCode provider adapter for the harness LLM seam.
//
// CommandCodeAdapter extends the abstract LlmAdapter from @deepseek-ai/dsh-llm;
// only stream() is required. Transport lives in request.ts; the request body
// is built by serialize.ts over the message translation from messages.ts.

import { createHash, randomUUID } from 'node:crypto'
import { LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  ReasoningEffortId as ReasoningEffortIdBrand,
  ResolvedRetryPolicy,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { buildBody, buildHeaders, deterministicStringify } from './serialize.js'
import { freezeTools, messagesToCC } from './messages.js'
import { streamRequest } from './request.js'
import type { CommandCodeConfig } from './types.js'

const REASONING_EFFORTS = ['off', 'high', 'max'] as const

export class CommandCodeAdapter extends LlmAdapter {
  private readonly getConfig: () => CommandCodeConfig
  private readonly resolveApiKey: (provider: string) => Promise<string | undefined>

  constructor(options: {
    getConfig: () => CommandCodeConfig
    resolveApiKey: (provider: string) => Promise<string | undefined>
  }) {
    super()
    this.getConfig = options.getConfig
    this.resolveApiKey = options.resolveApiKey
  }

  providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: this.getConfig().displayName }
  }

  providerRetryPolicy(): ResolvedRetryPolicy | undefined {
    return this.getConfig().retryPolicy
  }

  async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return this.getConfig().models.map((entry) => ({
      provider,
      id: entry.id,
      name: entry.name ?? entry.id,
      inputModalities: ['text'] as const,
    }))
  }

  async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const config = this.getConfig()
    const entry = config.models.find((candidate) => candidate.id === model)
    return {
      provider,
      id: model,
      name: entry?.name ?? model,
      context: { contextWindow: entry?.contextWindow ?? config.defaultContextWindow },
      defaultMaxTokens: entry?.maxTokens ?? config.defaultMaxTokens,
      reasoning: {
        efforts: REASONING_EFFORTS.map((id) => ({ id: ReasoningEffortId(id), name: id })),
        defaultEffort: config.reasoningEffort === undefined
          ? ReasoningEffortId('high')
          : ReasoningEffortId(config.reasoningEffort),
      },
    }
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk, void, void> {
    const config = this.getConfig()
    const apiKey = await this.resolveApiKey(options.provider)
    if (apiKey === undefined) {
      throw new LlmError(
        `commandcode: no credential for provider "${options.provider}"; `
        + `set ${config.apiKeyEnv} or store the key through Settings → Models`,
        'MISSING_CREDENTIAL',
      )
    }

    const { messages, systemParts } = messagesToCC(options.messages)
    const system = [options.system, ...systemParts].filter(Boolean).join('\n\n')
    const body = buildBody({
      model: options.model,
      messages,
      tools: freezeTools(options.tools ?? []),
      system,
      maxTokens: options.maxTokens ?? config.defaultMaxTokens,
      temperature: options.temperature,
      stop: options.stop,
      thinking: mapThinking(options.reasoningEffort, config),
      // A stable thread id per session keeps the proxy's prefix cache warm.
      // CommandCode validates threadId as a UUID, so the raw harness session
      // id (an arbitrary string) is mapped to a deterministic UUID instead.
      threadId: threadIdFor(options.sessionId !== undefined ? String(options.sessionId) : undefined),
    })

    const timeoutSignal = AbortSignal.timeout(config.streamIdleTimeoutMs)
    const signal = options.signal !== undefined
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal

    yield* streamRequest({
      baseURL: config.baseURL,
      headers: buildHeaders(apiKey, config.headers),
      body: deterministicStringify(body),
      signal,
      callerAborted: () => options.signal?.aborted ?? false,
    })
  }
}

/** Map a harness reasoning effort to the CommandCode thinking parameter. */
function mapThinking(
  effort: ReasoningEffortIdBrand | undefined,
  config: CommandCodeConfig,
): { type: 'enabled'; budget_tokens: number } | undefined {
  if (effort === undefined || effort === 'off') return undefined
  const budget = config.thinkingBudgets[effort]
  if (budget === undefined) return undefined
  return { type: 'enabled', budget_tokens: budget }
}

/**
 * CommandCode validates `threadId` as a UUID, but the harness session id is an
 * arbitrary string (e.g. `session-<uuid>`). Derive a deterministic UUID v5
 * from it (sha1-based, RFC 4122), so the thread stays stable per session —
 * the prefix-cache warmth the raw id was meant to provide — and always valid.
 */
function threadIdFor(sessionId: string | undefined): string {
  if (sessionId === undefined) return randomUUID()
  const digest = createHash('sha1').update(sessionId).digest()
  digest[6] = (digest[6]! & 0x0f) | 0x50 // version 5
  digest[8] = (digest[8]! & 0x3f) | 0x80 // variant 10xx
  const hex = digest.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
