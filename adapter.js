// adapter.js — the CommandCode provider adapter for the harness LLM seam.
//
// CommandCodeAdapter extends the abstract LlmAdapter from @deepseek-ai/dsh-llm;
// only stream() is required. It speaks the CommandCode Provider API
// (/alpha/generate) with the same wire format the pi-cleancache-commandcode
// extension uses.

import { randomUUID } from 'node:crypto'
import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
import { buildBody, buildHeaders, deterministicStringify } from './serialize.js'
import { parseEventLine } from './sse.js'
import { createTranslator, httpError } from './translate.js'
import { buildToolNameIndex, messagesToCC, freezeTools } from './messages.js'

const REASONING_EFFORTS = ['off', 'high', 'max']

export class CommandCodeAdapter extends LlmAdapter {
  /**
   * @param {object} options
   * @param {() => object} options.getConfig - thunk returning the validated
   *   configuration; re-read once per operation so live edits apply.
   * @param {(provider: string) => Promise<string|undefined>} options.resolveApiKey
   */
  constructor({ getConfig, resolveApiKey }) {
    super()
    this.getConfig = getConfig
    this.resolveApiKey = resolveApiKey
  }

  providerInfo(provider) {
    return { id: provider, name: this.getConfig().displayName }
  }

  providerRetryPolicy() {
    return this.getConfig().retryPolicy
  }

  async listModels(provider) {
    return this.getConfig().models.map((entry) => ({
      provider,
      id: entry.id,
      name: entry.name ?? entry.id,
      inputModalities: ['text'],
    }))
  }

  async resolveModel(provider, model) {
    const config = this.getConfig()
    const entry = config.models.find((candidate) => candidate.id === model)
    return {
      provider,
      id: model,
      name: entry?.name ?? model,
      context: { contextWindow: entry?.contextWindow ?? config.defaultContextWindow },
      defaultMaxTokens: entry?.maxTokens ?? config.defaultMaxTokens,
      reasoning: {
        efforts: REASONING_EFFORTS.map((id) => ({ id, name: id })),
        defaultEffort: config.reasoningEffort ?? 'high',
      },
    }
  }

  async *stream(options) {
    const config = this.getConfig()
    const apiKey = await this.resolveApiKey(options.provider)
    if (!apiKey) {
      throw new LlmError(
        `commandcode: no credential for provider "${options.provider}"; `
        + `set ${config.apiKeyEnv} or store the key through Settings → Models`,
        'MISSING_CREDENTIAL',
      )
    }

    const toolNameIndex = buildToolNameIndex(options.messages)
    const { messages, systemParts } = messagesToCC(options.messages, { toolNameIndex })
    const system = [options.system, ...systemParts].filter(Boolean).join('\n\n')
    const body = buildBody({
      model: options.model,
      messages,
      tools: freezeTools(options.tools ?? []),
      system,
      maxTokens: options.maxTokens ?? config.defaultMaxTokens,
      temperature: options.temperature,
      thinking: mapThinking(options.reasoningEffort, config),
      // A stable thread id per session keeps the proxy's prefix cache warm.
      threadId: options.sessionId ? String(options.sessionId) : randomUUID(),
    })

    const timeoutSignal = AbortSignal.timeout(config.streamIdleTimeoutMs)
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal

    let response
    try {
      response = await fetch(`${config.baseURL}/alpha/generate`, {
        method: 'POST',
        headers: buildHeaders(apiKey, config.headers),
        body: deterministicStringify(body),
        signal,
      })
    } catch (error) {
      if (options.signal?.aborted) throw new LlmError('commandcode: aborted by caller', 'ABORTED', { cause: error })
      if (error?.name === 'TimeoutError') throw new LlmError('commandcode: stream idle timeout', 'TIMEOUT', { cause: error })
      throw new LlmError(`commandcode: request to ${config.baseURL} failed`, 'TRANSPORT', { cause: error })
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw httpError(response.status, text)
    }
    if (!response.body) {
      throw new LlmError('commandcode: no response body', 'EMPTY_RESPONSE')
    }

    const translator = createTranslator()
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let sawFinish = false

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const evt = parseEventLine(line)
          if (!evt) continue
          if (evt.type === 'finish') sawFinish = true
          yield* translator.feed(evt)
        }
      }
      if (buffer.trim()) {
        const evt = parseEventLine(buffer)
        if (evt) {
          if (evt.type === 'finish') sawFinish = true
          yield* translator.feed(evt)
        }
      }
    } catch (error) {
      if (options.signal?.aborted) throw new LlmError('commandcode: aborted by caller', 'ABORTED', { cause: error })
      if (error?.name === 'TimeoutError') throw new LlmError('commandcode: stream idle timeout', 'TIMEOUT', { cause: error })
      throw error
    }

    if (!sawFinish) {
      if (options.signal?.aborted) throw new LlmError('commandcode: aborted by caller', 'ABORTED')
      throw new LlmError('commandcode: stream ended without a finish event', 'STREAM_CLOSED')
    }
  }
}

/** Map a harness reasoning effort to the CommandCode thinking parameter. */
function mapThinking(effort, config) {
  if (!effort || effort === 'off') return undefined
  const budget = config.thinkingBudgets?.[effort]
  if (budget === undefined) return undefined
  return { type: 'enabled', budget_tokens: budget }
}
