import type { FinishReason, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm';
import type { CcEvent, CcUsage } from './types.js';
/**
 * Create a streaming translator. Feed it parsed CommandCode events; it yields
 * harness chunks. One translator instance serves one response stream.
 */
export declare function createTranslator(): {
    feed(event: CcEvent): Generator<StreamChunk, void, void>;
};
/**
 * Map the proxy's totalUsage to the harness TokenUsage. The proxy reports
 * inputTokens as a total that may include cache reads; the harness expects
 * uncached input tokens with cache counted separately.
 */
export declare function usageFromTotalUsage(total: CcUsage | undefined): TokenUsage | undefined;
/** Map a CommandCode finish reason to a harness FinishReason. */
export declare function finishReasonFromWire(reason: string | undefined, emittedToolCalls: boolean): FinishReason;
