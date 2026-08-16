// adapter.ts — the CommandCode provider adapter for the harness LLM seam.
//
// CommandCodeAdapter extends the abstract LlmAdapter from @deepseek-ai/dsh-llm;
// only stream() is required. Transport lives in request.ts; the request body
// is built by serialize.ts over the message translation from messages.ts.
import { randomUUID } from 'node:crypto';
import { LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { buildBody, buildHeaders, deterministicStringify } from './serialize.js';
import { freezeTools, messagesToCC } from './messages.js';
import { streamRequest } from './request.js';
const REASONING_EFFORTS = ['off', 'high', 'max'];
export class CommandCodeAdapter extends LlmAdapter {
    getConfig;
    resolveApiKey;
    constructor(options) {
        super();
        this.getConfig = options.getConfig;
        this.resolveApiKey = options.resolveApiKey;
    }
    providerInfo(provider) {
        return { id: provider, name: this.getConfig().displayName };
    }
    providerRetryPolicy() {
        return this.getConfig().retryPolicy;
    }
    async listModels(provider) {
        return this.getConfig().models.map((entry) => ({
            provider,
            id: entry.id,
            name: entry.name ?? entry.id,
            inputModalities: ['text'],
        }));
    }
    async resolveModel(provider, model) {
        const config = this.getConfig();
        const entry = config.models.find((candidate) => candidate.id === model);
        return {
            provider,
            id: model,
            name: entry?.name ?? model,
            context: { contextWindow: entry?.contextWindow ?? config.defaultContextWindow },
            defaultMaxTokens: entry?.maxTokens ?? config.defaultMaxTokens,
            reasoning: {
                efforts: REASONING_EFFORTS.map((id) => ({ id: ReasoningEffortId(id), name: id })),
                defaultEffort: config.reasoningEffort === undefined
                    ? ReasoningEffortId('high')
                    : ReasoningEffortId(config.reasoningEffort),
            },
        };
    }
    async *stream(options) {
        const config = this.getConfig();
        const apiKey = await this.resolveApiKey(options.provider);
        if (apiKey === undefined) {
            throw new LlmError(`commandcode: no credential for provider "${options.provider}"; `
                + `set ${config.apiKeyEnv} or store the key through Settings → Models`, 'MISSING_CREDENTIAL');
        }
        const { messages, systemParts } = messagesToCC(options.messages);
        const system = [options.system, ...systemParts].filter(Boolean).join('\n\n');
        const body = buildBody({
            model: options.model,
            messages,
            tools: freezeTools(options.tools ?? []),
            system,
            maxTokens: options.maxTokens ?? config.defaultMaxTokens,
            temperature: options.temperature,
            thinking: mapThinking(options.reasoningEffort, config),
            // A stable thread id per session keeps the proxy's prefix cache warm.
            threadId: options.sessionId !== undefined ? String(options.sessionId) : randomUUID(),
        });
        const timeoutSignal = AbortSignal.timeout(config.streamIdleTimeoutMs);
        const signal = options.signal !== undefined
            ? AbortSignal.any([options.signal, timeoutSignal])
            : timeoutSignal;
        yield* streamRequest({
            baseURL: config.baseURL,
            headers: buildHeaders(apiKey, config.headers),
            body: deterministicStringify(body),
            signal,
            callerAborted: () => options.signal?.aborted ?? false,
        });
    }
}
/** Map a harness reasoning effort to the CommandCode thinking parameter. */
function mapThinking(effort, config) {
    if (effort === undefined || effort === 'off')
        return undefined;
    const budget = config.thinkingBudgets[effort];
    if (budget === undefined)
        return undefined;
    return { type: 'enabled', budget_tokens: budget };
}
