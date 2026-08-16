// sse.ts — one-line parser for the CommandCode event stream.
//
// Lines are either comments (":" or "event:"), "data:" lines, raw JSON lines,
// or "[DONE]". Only JSON payloads yield events; everything else is skipped.

import type { CcEvent } from './types.js'

/**
 * @param line - one trimmed line of the stream.
 * @returns the parsed event, or undefined when the line carries no payload.
 */
export function parseEventLine(line: string): CcEvent | undefined {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) return undefined
  const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
  if (!data || data === '[DONE]') return undefined
  try {
    return JSON.parse(data) as CcEvent
  } catch {
    return undefined
  }
}
