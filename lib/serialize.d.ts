import type { CcMessage, CcTool } from './types.js';
export declare const COMMANDCODE_CLI_VERSION = "0.40.11";
/** Frozen config object: no dynamic metadata, so request prefixes stay stable. */
export declare const STATIC_CONFIG: {
    readonly workingDir: "/project";
    readonly date: "2026-01-01";
    readonly environment: "dsh-llm-commandcode";
    readonly structure: readonly [];
    readonly isGitRepo: false;
    readonly currentBranch: "";
    readonly mainBranch: "";
    readonly gitStatus: "";
    readonly recentCommits: readonly [];
};
/** Headers every provider request sends. extra merges user-configured headers. */
export declare function buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string>;
export interface BuildBodyOptions {
    model: string;
    messages: CcMessage[];
    tools: readonly CcTool[];
    system: string;
    maxTokens: number;
    temperature?: number;
    thinking?: {
        type: 'enabled';
        budget_tokens: number;
    };
    threadId: string;
}
/** Build the full /alpha/generate request body. */
export declare function buildBody(options: BuildBodyOptions): Record<string, unknown>;
/** JSON with sorted keys, so equal payloads serialize byte-identically. */
export declare function deterministicStringify(value: unknown): string;
