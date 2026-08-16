import type { StreamChunk } from '@deepseek-ai/dsh-llm';
export interface StreamRequestOptions {
    baseURL: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
    callerAborted: () => boolean;
}
/** Stream one provider request, yielding harness chunks. */
export declare function streamRequest(options: StreamRequestOptions): AsyncGenerator<StreamChunk, void, void>;
