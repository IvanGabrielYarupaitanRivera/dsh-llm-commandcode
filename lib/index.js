// index.ts — Cordis plugin entry for dsh-llm-commandcode.
//
// Registers the `commandcode` provider route, advertises it in the
// configurable-provider directory (Settings → Models), offers model discovery,
// and wires the optional user-settings section (`llm-commandcode:`).
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { CommandCodeAdapter } from './adapter.js';
import { Config, normalizeConfig } from './config.js';
import { discoverModels } from './discovery.js';
export const name = 'llm-commandcode';
export const inject = ['llm'];
export { Config } from './config.js';
export { CommandCodeAdapter } from './adapter.js';
const NS = settingsNamespace('llm-commandcode');
export function apply(ctx, config = {}) {
    let current = () => normalizeConfig(config);
    const resolveApiKey = async (provider) => {
        const ref = current().apiKeyEnv;
        // The credentials service is optional and registered by the harness base
        // bundle; without it, the process environment is the whole credential
        // plane. Types for it live in @deepseek-ai/dsh-credentials, which this
        // plugin deliberately does not depend on.
        const credentials = ctx.get('credentials');
        const hit = credentials !== undefined
            ? (await credentials.resolve(ref))?.value
            : undefined;
        if (hit !== undefined && hit.length > 0)
            return hit;
        const env = process.env[ref];
        if (env !== undefined && env.length > 0)
            return env;
        return undefined;
    };
    const adapter = new CommandCodeAdapter({
        // A thunk, not `current` itself: the adapter stores the function it
        // receives, so passing the arrow directly would freeze it at the
        // composition entry forever — settings-section changes (models, baseURL,
        // retryPolicy, …) would never reach the adapter. Reading the `current`
        // variable at call time keeps the adapter live against setSource swaps.
        getConfig: () => current(),
        resolveApiKey,
    });
    ctx.llm.registerAdapter(['commandcode'], adapter);
    ctx.llm.registerConfigurableProviders([{
            provider: 'commandcode',
            displayName: 'Command Code',
            settingsNs: NS,
            settingsPath: [],
        }]);
    ctx.llm.registerModelDiscovery(NS, async (request) => {
        // The harness never resolves the stored credential for a discovery draft
        // ("the caller owns both"), and the card only sends apiKey when the key
        // was typed in that session — so fall back to the stored credential here,
        // the same resolveApiKey the adapter's stream() path uses.
        const apiKey = request.apiKey ?? await resolveApiKey(request.provider ?? 'commandcode');
        return discoverModels(apiKey === undefined ? request : { ...request, apiKey }, () => current().baseURL);
    });
    // Optional user-settings section: lets Settings → Models and a
    // `llm-commandcode:` section in settings.yaml override the composition
    // config without a restart. Without a mounted settings service the entry
    // config alone drives the adapter.
    installSettingsSection(ctx, NS, Config, config, {
        validate: (raw) => {
            normalizeConfig(raw);
        },
        setSource: (source) => {
            current = () => normalizeConfig(source());
        },
        onChange: () => { },
    });
}
