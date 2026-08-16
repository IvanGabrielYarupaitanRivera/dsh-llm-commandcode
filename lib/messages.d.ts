import type { Message, ToolSchema } from '@deepseek-ai/dsh-llm';
import type { CcMessage, CcTool } from './types.js';
/**
 * Index assistant tool-call blocks by their id so tool results can carry the
 * tool name (CommandCode asks for it; the harness ToolResultBlock does not).
 */
export declare function buildToolNameIndex(messages: readonly Message[]): Map<string, string>;
/**
 * Convert a harness message list to CommandCode messages. System-role message
 * text is returned separately so the caller can fold it into params.system.
 */
export declare function messagesToCC(messages: readonly Message[]): {
    messages: CcMessage[];
    systemParts: string[];
};
/** Convert one harness tool-result message (role user, one tool-result block). */
export declare function convertToolResult(message: Message, toolNameIndex: Map<string, string>): CcMessage;
/**
 * Tools in CommandCode's function shape, sorted by name for byte-stable
 * prefixes (better prefix-cache reuse on the proxy).
 */
export declare function freezeTools(tools: readonly ToolSchema[]): CcTool[];
