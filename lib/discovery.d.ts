import type { LlmDiscoveredModel, LlmModelDiscoveryRequest } from '@deepseek-ai/dsh-llm';
export declare function discoverModels(request: LlmModelDiscoveryRequest, getBaseURL: () => string): Promise<readonly LlmDiscoveredModel[]>;
