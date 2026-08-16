// translate.ts — map CommandCode stream events to harness StreamChunks.
//
// StreamChunk contract (from @deepseek-ai/dsh-llm): adapters emit block-start,
// deltas, block-end, usage before the terminal finish, and nothing afterward;
// tool arguments stay raw JSON strings.

import { CallId } from '@deepseek-ai/dsh-llm'
import type { FinishReason, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import type { CcEvent, CcUsage } from './types.js'

interface OpenBlock {
  index: number
  parts: string[]
}

/**
 * Create a streaming translator. Feed it parsed CommandCode events; it yields
 * harness chunks. One translator instance serves one response stream.
 */
export function createTranslator(): {
  feed(event: CcEvent): Generator<StreamChunk, void, void>
} {
  let nextIndex = 0
  let reasoning: OpenBlock | null = null
  let text: OpenBlock | null = null
  let toolCalls = 0
  let terminal = false

  function* feed(event: CcEvent): Generator<StreamChunk, void, void> {
    if (terminal) return
    switch (event.type) {
      case 'reasoning-start': {
        reasoning = { index: nextIndex++, parts: [] }
        yield { type: 'block-start', index: reasoning.index, blockType: 'reasoning' }
        break
      }
      case 'reasoning-delta': {
        if (reasoning === null) {
          reasoning = { index: nextIndex++, parts: [] }
          yield { type: 'block-start', index: reasoning.index, blockType: 'reasoning' }
        }
        reasoning.parts.push(event.text ?? '')
        yield { type: 'reasoning-delta', index: reasoning.index, text: event.text ?? '' }
        break
      }
      case 'reasoning-end': {
        if (reasoning !== null) {
          yield { type: 'block-end', index: reasoning.index, block: { type: 'reasoning', text: reasoning.parts.join('') } }
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
        if (text === null) {
          text = { index: nextIndex++, parts: [] }
          yield { type: 'block-start', index: text.index, blockType: 'text' }
        }
        text.parts.push(event.text ?? '')
        yield { type: 'text-delta', index: text.index, text: event.text ?? '' }
        break
      }
      case 'text-end': {
        if (text !== null) {
          yield { type: 'block-end', index: text.index, block: { type: 'text', text: text.parts.join('') } }
          text = null
        }
        break
      }
      case 'tool-call': {
        const args = event.arguments ?? event.args ?? event.input ?? {}
        const argsJson = typeof args === 'string' ? args : JSON.stringify(args ?? {})
        const index = nextIndex++
        toolCalls++
        yield {
          type: 'tool-call-delta',
          index,
          id: CallId(event.toolCallId ?? ''),
          name: event.toolName,
          argumentsDelta: argsJson,
        }
        yield {
          type: 'block-end',
          index,
          block: {
            type: 'tool-call',
            id: CallId(event.toolCallId ?? ''),
            name: event.toolName ?? '',
            arguments: argsJson,
          },
        }
        break
      }
      case 'finish': {
        if (reasoning !== null) {
          yield { type: 'block-end', index: reasoning.index, block: { type: 'reasoning', text: reasoning.parts.join('') } }
          reasoning = null
        }
        if (text !== null) {
          yield { type: 'block-end', index: text.index, block: { type: 'text', text: text.parts.join('') } }
          text = null
        }
        const usage = usageFromTotalUsage(event.totalUsage)
        if (usage !== undefined) yield { type: 'usage', usage }
        const reason: FinishReason = event.finishReason === 'error'
          ? { kind: 'error', failure: { message: 'commandcode: error finish event', code: 'ERROR' } }
          : finishReasonFromWire(event.finishReason, toolCalls > 0)
        terminal = true
        yield { type: 'finish', reason }
        break
      }
      case 'error': {
        const message = typeof event.error === 'string'
          ? event.error
          : JSON.stringify(event.error ?? 'commandcode error event')
        terminal = true
        yield { type: 'finish', reason: { kind: 'error', failure: { message, code: 'ERROR' } } }
        break
      }
      default:
        // start, start-step, finish-step, tool-result, provider-metadata:
        // transport bookkeeping with no model-visible content.
        break
    }
  }

  return { feed }
}

/**
 * Map the proxy's totalUsage to the harness TokenUsage. The proxy reports
 * inputTokens as a total that may include cache reads; the harness expects
 * uncached input tokens with cache counted separately.
 */
export function usageFromTotalUsage(total: CcUsage | undefined): TokenUsage | undefined {
  if (total === undefined) return undefined
  const details = total.inputTokenDetails ?? {}
  const outputDetails = total.outputTokenDetails ?? {}
  const noCache = typeof details.noCacheTokens === 'number' ? details.noCacheTokens : undefined
  const cacheRead = typeof details.cacheReadTokens === 'number'
    ? details.cacheReadTokens
    : typeof total.cachedInputTokens === 'number'
      ? total.cachedInputTokens
      : undefined
  const usage: TokenUsage = {
    inputTokens: noCache ?? total.inputTokens ?? 0,
    outputTokens: total.outputTokens ?? 0,
    reasoningTokens: total.reasoningTokens ?? outputDetails.reasoningTokens,
  }
  if (cacheRead !== undefined && cacheRead > 0) usage.cacheReadTokens = cacheRead
  return usage
}

/** Map a CommandCode finish reason to a harness FinishReason. */
export function finishReasonFromWire(
  reason: string | undefined,
  emittedToolCalls: boolean,
): FinishReason {
  if (reason === 'aborted') {
    return { kind: 'aborted', failure: { message: 'commandcode: aborted', code: 'ABORTED' } }
  }
  if (reason === 'max_tokens' || reason === 'length') return { kind: 'max-tokens' }
  if (emittedToolCalls) return { kind: 'tool-calls' }
  return { kind: 'stop' }
}
