import type { RetryPolicyConfig, ResolvedRetryPolicy } from '@deepseek-ai/dsh-llm';
/** One text block in the CommandCode message format. */
export interface CcTextBlock {
    type: 'text';
    text: string;
}
/** Reasoning (thinking) content, distinct from visible text. */
export interface CcReasoningBlock {
    type: 'reasoning';
    text: string;
}
/** A tool invocation produced by the model. */
export interface CcToolCallBlock {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    input: unknown;
}
/** The result of a tool invocation, sent back to the model. */
export interface CcToolResultBlock {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    output: {
        type: 'text' | 'error-text';
        value: string;
    };
}
export type CcContentBlock = CcTextBlock | CcReasoningBlock | CcToolCallBlock | CcToolResultBlock;
export type CcMessage = {
    role: 'user';
    content: string | CcTextBlock[];
} | {
    role: 'assistant';
    content: CcContentBlock[];
} | {
    role: 'tool';
    content: [CcToolResultBlock];
};
/** A function tool in the CommandCode wire shape. */
export interface CcTool {
    type: 'function';
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}
/** Token accounting reported by the proxy on the finish event. */
export interface CcUsage {
    inputTokens?: number;
    inputTokenDetails?: {
        noCacheTokens?: number;
        cacheReadTokens?: number;
    };
    outputTokens?: number;
    outputTokenDetails?: {
        textTokens?: number;
        reasoningTokens?: number;
    };
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
}
/** One parsed line of the CommandCode SSE stream. */
export type CcEvent = {
    type: 'start';
} | {
    type: 'start-step';
} | {
    type: 'reasoning-start';
} | {
    type: 'reasoning-delta';
    text?: string;
} | {
    type: 'reasoning-end';
} | {
    type: 'text-start';
} | {
    type: 'text-delta';
    text?: string;
} | {
    type: 'text-end';
} | {
    type: 'tool-call';
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
    input?: unknown;
    arguments?: unknown;
} | {
    type: 'tool-result';
} | {
    type: 'finish';
    finishReason?: string;
    totalUsage?: CcUsage;
} | {
    type: 'finish-step';
} | {
    type: 'error';
    error?: unknown;
} | {
    type: 'provider-metadata';
};
/** One catalog entry advertised by the adapter. */
export interface CommandCodeModelEntry {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
}
/** The configuration as the user writes it (schema-validated). */
export interface RawCommandCodeConfig {
    apiKeyEnv?: string;
    displayName?: string;
    baseURL?: string;
    models?: CommandCodeModelEntry[];
    defaultContextWindow?: number;
    defaultMaxTokens?: number;
    reasoningEffort?: 'off' | 'high' | 'max';
    thinkingBudgets?: Record<string, number>;
    headers?: Record<string, string>;
    streamIdleTimeoutMs?: number;
    retryPolicy?: RetryPolicyConfig;
}
/** The validated configuration the adapter reads per request. */
export interface CommandCodeConfig {
    apiKeyEnv: string;
    displayName: string;
    baseURL: string;
    models: CommandCodeModelEntry[];
    defaultContextWindow: number;
    defaultMaxTokens: number;
    reasoningEffort?: 'off' | 'high' | 'max';
    thinkingBudgets: Record<string, number>;
    headers: Record<string, string>;
    streamIdleTimeoutMs: number;
    retryPolicy?: ResolvedRetryPolicy;
}
