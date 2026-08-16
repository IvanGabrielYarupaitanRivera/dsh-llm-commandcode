// sse.js — one-line parser for the CommandCode event stream.
//
// Lines are either comments (":" or "event:"), "data:" lines, raw JSON lines,
// or "[DONE]". Only JSON payloads yield events; everything else is skipped.

/**
 * @param {string} line - one trimmed line of the stream.
 * @returns {object|undefined} the parsed event, or undefined when the line
 *   carries no event payload.
 */
export function parseEventLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) return undefined
  const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
  if (!data || data === '[DONE]') return undefined
  try {
    return JSON.parse(data)
  } catch {
    return undefined
  }
}
