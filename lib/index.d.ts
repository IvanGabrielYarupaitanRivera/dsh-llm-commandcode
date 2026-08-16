import type { Context } from '@deepseek-ai/cordis';
import type { RawCommandCodeConfig } from './types.js';
export declare const name = "llm-commandcode";
export declare const inject: readonly ["llm"];
export { Config } from './config.js';
export { CommandCodeAdapter } from './adapter.js';
export type { CommandCodeConfig, RawCommandCodeConfig } from './types.js';
export declare function apply(ctx: Context, config?: RawCommandCodeConfig): void;
