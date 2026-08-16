import { LlmError } from '@deepseek-ai/dsh-llm';
/** Build the LlmError for a non-2xx provider response. */
export declare function httpError(status: number, bodyText: string): LlmError;
/** Classify a fetch failure (DNS, refused connection, TLS, proxy). */
export declare function classifyTransportError(error: unknown, baseURL: string, callerAborted: () => boolean): LlmError;
/** Classify a body-read failure; keeps an already-mapped LlmError as-is. */
export declare function classifyReadError(error: unknown, callerAborted: () => boolean): LlmError;
