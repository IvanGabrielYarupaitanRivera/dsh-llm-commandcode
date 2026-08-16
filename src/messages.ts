// messages.ts — translate harness Message[] to the CommandCode wire format.
//
// CommandCode expects roles user / assistant / tool with content blocks:
//   - user      → string | array of text (and image) blocks
//   - assistant → array of text / reasoning / tool-call blocks
//   - tool      → array with a single tool-result block

import type { ContentBlock, Message, ToolSchema } from '@deepseek-ai/dsh-llm'
import type { CcContentBlock, CcMessage, CcTextBlock, CcTool } from './types.js'

/**
 * Index assistant tool-call blocks by their id so tool results can carry the
 * tool name (CommandCode asks for it; the harness ToolResultBlock does not).
 */
export function buildToolNameIndex(messages: readonly Message[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const block of message.content) {
      if (block.type === 'tool-call') index.set(block.id, block.name)
    }
  }
  return index
}

/**
 * Convert a harness message list to CommandCode messages. System-role message
 * text is returned separately so the caller can fold it into params.system.
 */
export function messagesToCC(
  messages: readonly Message[],
): { messages: CcMessage[]; systemParts: string[] } {
  const toolNameIndex = buildToolNameIndex(messages)
  const out: CcMessage[] = []
  const systemParts: string[] = []
  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(extractText(message.content))
      continue
    }
    if (message.content[0]?.type === 'tool-result') {
      out.push(convertToolResult(message, toolNameIndex))
    } else if (message.role === 'user') {
      out.push(convertUser(message))
    } else if (message.role === 'assistant') {
      const parts = convertAssistant(message)
      if (parts.length > 0) out.push({ role: 'assistant', content: parts })
    }
  }
  return { messages: out, systemParts }
}

function convertUser(message: Message): CcMessage {
  const blocks: CcTextBlock[] = []
  for (const block of message.content) {
    if (block.type === 'text' && block.text) blocks.push({ type: 'text', text: block.text })
    // Image blocks are skipped: every catalog model declares text-only input
    // (see README "Known limitations"), so the harness refuses images earlier.
  }
  if (blocks.length === 0) return { role: 'user', content: '' }
  if (blocks.length === 1) return { role: 'user', content: blocks[0]!.text }
  return { role: 'user', content: blocks }
}

function convertAssistant(message: Message): CcContentBlock[] {
  const parts: CcContentBlock[] = []
  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      parts.push({ type: 'text', text: block.text })
    } else if (block.type === 'reasoning' && block.text) {
      parts.push({ type: 'reasoning', text: block.text })
    } else if (block.type === 'tool-call') {
      parts.push({
        type: 'tool-call',
        toolCallId: block.id,
        toolName: block.name,
        input: parseArguments(block.arguments),
      })
    }
  }
  return parts
}

/** Convert one harness tool-result message (role user, one tool-result block). */
export function convertToolResult(
  message: Message,
  toolNameIndex: Map<string, string>,
): CcMessage {
  const block = message.content[0]
  const toolCallId = block !== undefined && block.type === 'tool-result' ? block.toolCallId : ''
  const value = block !== undefined && block.type === 'tool-result'
    ? extractText(block.content) || '(no output)'
    : '(no output)'
  return {
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId,
      toolName: toolNameIndex.get(toolCallId) ?? '',
      output: {
        type: block?.type === 'tool-result' && block.isError === true ? 'error-text' : 'text',
        value,
      },
    }],
  }
}

/**
 * Tools in CommandCode's function shape, sorted by name for byte-stable
 * prefixes (better prefix-cache reuse on the proxy).
 */
export function freezeTools(tools: readonly ToolSchema[]): CcTool[] {
  return [...tools]
    .map((tool): CcTool => ({
      type: 'function',
      name: tool.name,
      description: tool.description ?? '',
      input_schema: tool.parameters ?? {},
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function extractText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}
