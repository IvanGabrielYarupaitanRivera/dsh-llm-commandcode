import z from '@deepseek-ai/schemastery';
import type { CommandCodeConfig, RawCommandCodeConfig } from './types.js';
export declare const Config: z<RawCommandCodeConfig>;
/**
 * Validate a raw configuration object and produce the facts the adapter reads.
 * Throws on values the adapter cannot serve; never silently fixes them.
 */
export declare function normalizeConfig(raw?: RawCommandCodeConfig): CommandCodeConfig;
