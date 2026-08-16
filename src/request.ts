// request.ts — the HTTP + SSE transport for one /alpha/generate call.
//
// Owns the fetch, the non-2xx mapping, the SSE line loop, and the finish-event
// guarantee. Translation of events to chunks stays in translate.ts; the
// adapter stays focused on the harness contract.

import { LlmError } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { parseEventLine } from './sse.js'
import { createTranslator } from './translate.js'
import { classifyReadError, classifyTransportError, httpError } from './errors.js'

export interface StreamRequestOptions {
  baseURL: string
  headers: Record<string, string>
  body: string
  signal: AbortSignal
  callerAborted: () => boolean
}

/** Stream one provider request, yielding harness chunks. */
export async function* streamRequest(
  options: StreamRequestOptions,
): AsyncGenerator<StreamChunk, void, void> {
  let response: Response
  try {
    response = await fetch(`${options.baseURL}/alpha/generate`, {
      method: 'POST',
      headers: options.headers,
      body: options.body,
      signal: options.signal,
    })
  } catch (error) {
    throw classifyTransportError(error, options.baseURL, options.callerAborted)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw httpError(response.status, text)
  }
  if (response.body === null) {
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
        const event = parseEventLine(line)
        if (event === undefined) continue
        if (event.type === 'finish') sawFinish = true
        yield* translator.feed(event)
      }
    }
    if (buffer.trim() !== '') {
      const event = parseEventLine(buffer)
      if (event !== undefined) {
        if (event.type === 'finish') sawFinish = true
        yield* translator.feed(event)
      }
    }
  } catch (error) {
    throw classifyReadError(error, options.callerAborted)
  }

  if (!sawFinish) {
    if (options.callerAborted()) throw new LlmError('commandcode: aborted by caller', 'ABORTED')
    throw new LlmError('commandcode: stream ended without a finish event', 'STREAM_CLOSED')
  }
}
