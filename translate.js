// translate.js — map CommandCode stream events to harness StreamChunks.
//
// StreamChunk contract (from @deepseek-ai/dsh-llm): adapters emit block-start,
// deltas, block-end, usage before the terminal finish, and nothing afterward;
// tool arguments stay raw JSON strings.

import { LlmError } from '@deepseek-ai/dsh-llm'

/**
 * Create a streaming translator. Feed it parsed CommandCode events; it yields
 * harness chunks. One translator instance serves one response stream.
 */
export function createTranslator() {
  let nextIndex = 0
  let reasoning = null // { index, parts }
  let text = null // { index, parts }
  let toolCalls = 0
  let terminal = false

  return {
    /** @param {object} evt - one parsed CommandCode event. */
    *feed(evt) {
      if (terminal) return
      switch (evt.type) {
        case 'reasoning-start': {
          reasoning = { index: nextIndex++, parts: [] }
          yield { type: 'block-start', index: reasoning.index, blockType: 'reasoning' }
          break
        }
        case 'reasoning-delta': {
          if (!reasoning) {
            reasoning = { index: nextIndex++, parts: [] }
            yield { type: 'block-start', index: reasoning.index, blockType: 'reasoning' }
          }
          reasoning.parts.push(evt.text ?? '')
          yield { type: 'reasoning-delta', index: reasoning.index, text: evt.text ?? '' }
          break
        }
        case 'reasoning-end': {
          if (reasoning) {
            const block = { type: 'reasoning', text: reasoning.parts.join('') }
            yield { type: 'block-end', index: reasoning.index, block }
            reasoning = null
          }
          break
        }
        case 'text-start': {
          text = { index: nextIndex++, parts: [] }
          yield { type: 'block-start', index: text.index, blockType: 'text' }
          break
        }
        case 'text-delta': {
          if (!text) {
            text = { index: nextIndex++, parts: [] }
            yield { type: 'block-start', index: text.index, blockType: 'text' }
          }
          text.parts.push(evt.text ?? '')
          yield { type: 'text-delta', index: text.index, text: evt.text ?? '' }
          break
        }
        case 'text-end': {
          if (text) {
            const block = { type: 'text', text: text.parts.join('') }
            yield { type: 'block-end', index: text.index, block }
            text = null
          }
          break
        }
        case 'tool-call': {
          const args = evt.arguments ?? evt.args ?? evt.input ?? {}
          const argsJson = typeof args === 'string' ? args : JSON.stringify(args ?? {})
          const index = nextIndex++
          toolCalls++
          yield {
            type: 'tool-call-delta',
            index,
            id: evt.toolCallId ?? '',
            name: evt.toolName,
            argumentsDelta: argsJson,
          }
          yield {
            type: 'block-end',
            index,
            block: {
              type: 'tool-call',
              id: evt.toolCallId ?? '',
              name: evt.toolName ?? '',
              arguments: argsJson,
            },
          }
          break
        }
        case 'finish': {
          // Close any block the proxy forgot to end.
          if (reasoning) {
            yield { type: 'block-end', index: reasoning.index, block: { type: 'reasoning', text: reasoning.parts.join('') } }
            reasoning = null
          }
          if (text) {
            yield { type: 'block-end', index: text.index, block: { type: 'text', text: text.parts.join('') } }
            text = null
          }
          const usage = usageFromTotalUsage(evt.totalUsage)
          if (usage) yield { type: 'usage', usage }
          const reason = evt.finishReason === 'error'
            ? { kind: 'error', failure: { message: 'commandcode: error finish event', code: 'ERROR' } }
            : finishReasonFromWire(evt.finishReason, toolCalls > 0)
          terminal = true
          yield { type: 'finish', reason }
          break
        }
        case 'error': {
          const message = typeof evt.error === 'string'
            ? evt.error
            : JSON.stringify(evt.error ?? 'commandcode error event')
          terminal = true
          yield { type: 'finish', reason: { kind: 'error', failure: { message, code: 'ERROR' } } }
          break
        }
        default:
          // start, start-step, finish-step, tool-result, provider-metadata:
          // transport bookkeeping with no model-visible content.
          break
      }
    },
  }
}

/**
 * Map the proxy's totalUsage to the harness TokenUsage. The proxy reports
 * inputTokens as a total that may include cache reads; the harness expects
 * uncached input tokens with cache counted separately.
 */
export function usageFromTotalUsage(total) {
  if (!total || typeof total !== 'object') return undefined
  const details = total.inputTokenDetails ?? {}
  const outputDetails = total.outputTokenDetails ?? {}
  const noCache = typeof details.noCacheTokens === 'number' ? details.noCacheTokens : undefined
  const cacheRead = typeof details.cacheReadTokens === 'number'
    ? details.cacheReadTokens
    : typeof total.cachedInputTokens === 'number'
      ? total.cachedInputTokens
      : undefined
  const usage = {
    inputTokens: noCache ?? total.inputTokens ?? 0,
    outputTokens: total.outputTokens ?? 0,
    reasoningTokens: total.reasoningTokens ?? outputDetails.reasoningTokens,
  }
  if (cacheRead !== undefined && cacheRead > 0) usage.cacheReadTokens = cacheRead
  return usage
}

/** Map a CommandCode finish reason to a harness FinishReason. */
export function finishReasonFromWire(reason, emittedToolCalls) {
  if (reason === 'aborted') {
    return { kind: 'aborted', failure: { message: 'commandcode: aborted', code: 'ABORTED' } }
  }
  if (reason === 'max_tokens' || reason === 'length') return { kind: 'max-tokens' }
  if (emittedToolCalls) return { kind: 'tool-calls' }
  return { kind: 'stop' }
}

/** Build the LlmError for a non-2xx provider response. */
export function httpError(status, bodyText) {
  const message = bodyText || `commandcode: HTTP ${status}`
  const failure = { status }
  if (status === 401 || status === 403) {
    return new LlmError(message, 'AUTH', failure)
  }
  if (status === 429) {
    return new LlmError(message, /quota|balance|credit/i.test(message) ? 'QUOTA' : 'RATE_LIMIT', failure)
  }
  if (status === 400) {
    const code = /context|token|window|length/i.test(message)
      ? 'CONTEXT_WINDOW_EXCEEDED'
      : /quota|balance|credit/i.test(message)
        ? 'QUOTA'
        : 'INVALID_REQUEST'
    return new LlmError(message, code, failure)
  }
  if (status >= 500) return new LlmError(message, 'SERVER', failure)
  return new LlmError(message, `HTTP_${status}`, failure)
}
