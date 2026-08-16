import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, ResolvedRetryPolicy, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { CommandCodeConfig } from './types.js';
export declare class CommandCodeAdapter extends LlmAdapter {
    private readonly getConfig;
    private readonly resolveApiKey;
    constructor(options: {
        getConfig: () => CommandCodeConfig;
        resolveApiKey: (provider: string) => Promise<string | undefined>;
    });
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy | undefined;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncGenerator<StreamChunk, void, void>;
}
