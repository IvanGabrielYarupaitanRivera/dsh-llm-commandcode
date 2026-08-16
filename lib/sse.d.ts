import type { CcEvent } from './types.js';
/**
 * @param line - one trimmed line of the stream.
 * @returns the parsed event, or undefined when the line carries no payload.
 */
export declare function parseEventLine(line: string): CcEvent | undefined;
