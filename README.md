# dsh-llm-commandcode

**Command Code provider for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**
Use your CommandCode subscription (DeepSeek, Claude, GPT, Gemini and 30+ more
models) as a model provider inside the harness — install, paste your key, pick
a model, done.

- [Español](#español)

## What it does

This plugin adds a new provider route (`commandcode`) to the harness LLM seam.
It speaks the official
[Command Code Provider API](https://commandcode.ai/docs/provider)
(`/alpha/generate`) — the same wire format the popular `pi-cleancache-commandcode`
extension uses for Pi — and translates it to the harness `StreamChunk` protocol.
Written in TypeScript; ships prebuilt `lib/`.

## Requirements

- DeepSeek Harness installed (`dsh` CLI)
- A CommandCode account with an active subscription
- Your CommandCode API key (starts with `user_`)

## Install

From a terminal, in the profile you want to use (usually the web profile):

```sh
dsh plugin --profile web add dsh-llm-commandcode
```

Or directly from this repository:

```sh
dsh plugin --profile web add github:<your-user>/dsh-llm-commandcode
```

Restart the server (`Ctrl+C`, then start it again).

## Use

1. Open the Web UI → **Settings → Models**.
2. Find the **Command Code** card and paste your API key (`user_...`).
3. Optional: **Fetch available models** to load the full catalog, or use the
   models that ship by default (DeepSeek V4 Flash/Pro, Claude Sonnet 5,
   GPT-5.6 Sol, Gemini 3.5 Flash).
4. Start a session and select a model in the composer.

If you prefer the command line, set the key as an environment variable:

```sh
export COMMANDCODE_API_KEY=user_...
```

## Configuration

Everything is optional. The plugin works with just the API key.

| Field | Default | Description |
|---|---|---|
| `apiKeyEnv` | `COMMANDCODE_API_KEY` | Credential reference for the key |
| `baseURL` | `https://api.commandcode.ai` | CommandCode API base URL |
| `models` | DeepSeek + Claude + GPT + Gemini | Catalog advertised to selectors |
| `reasoningEffort` | `high` | Default effort: `off` \| `high` \| `max` |
| `thinkingBudgets` | `{high: 2048, max: 8192}` | Effort → `budget_tokens` |
| `headers` | `{}` | Extra headers merged into every request |
| `streamIdleTimeoutMs` | `300000` | Idle timeout for one provider read |
| `retryPolicy` | normal defaults | Retry policy for agent-level retries |

Override via a `llm-commandcode:` section in `$DSH_HOME/settings.yaml`, e.g.:

```yaml
llm-commandcode:
  apiKeyEnv: COMMANDCODE_API_KEY
  models:
    - id: deepseek/deepseek-v4-flash
      name: DeepSeek V4 Flash
    - id: deepseek/deepseek-v4-pro
      name: DeepSeek V4 Pro
```

## How it works (short version)

The adapter builds the CommandCode request envelope (frozen config, sorted
tools, stable headers for prefix-cache reuse), POSTs to `/alpha/generate`, and
translates the SSE event stream (`text-delta`, `reasoning-delta`, `tool-call`,
`finish`, …) into harness chunks. Usage and reasoning tokens are mapped to the
harness `TokenUsage` shape. Errors map to stable harness codes (`AUTH`,
`RATE_LIMIT`, `QUOTA`, `TRANSPORT`, …).

## Structure

```
src/
├── types.ts      CommandCode wire vocabulary + configuration shapes
├── config.ts     Schemastery schema, defaults, validation
├── messages.ts   Harness history → CommandCode messages (+ tools)
├── serialize.ts  Request envelope, headers, deterministic JSON
├── sse.ts        One-line SSE event parser
├── translate.ts  Events → harness StreamChunks (+ usage mapping)
├── errors.ts     HTTP/transport errors → stable LlmError codes
├── request.ts    fetch + SSE stream driver for one call
├── adapter.ts    CommandCodeAdapter (the LlmAdapter implementation)
├── discovery.ts  "Fetch available models" interrogation
└── index.ts      Cordis plugin entry (registration, settings, credentials)
```

## Development

```sh
npm install          # or: pnpm install
npm run build        # tsc → lib/ (ship lib/ so git installs need no build)
COMMANDCODE_API_KEY=user_... npm run test:standalone
```

During local development against a harness checkout, the `node_modules`
junctions for `@deepseek-ai/*` resolve through the checkout's packages; the
published package declares its real dependencies in `package.json`.

## Known limitations

- **Text-only for now.** Catalog models declare `[text]` input; images are
  refused before sending (harness-side). Image support needs the attachments
  service and is planned.
- **`reasoningEffort: off` may still reason.** The proxy decides by backend; we
  simply omit the `thinking` parameter for `off`.
- **Model listing shape is best-effort.** Discovery parses the
  `/provider/v1/models` response defensively; if CommandCode changes the shape,
  enter models by hand.
- **`toolName` on tool results.** The harness tool-result block carries no tool
  name; the adapter recovers it from history and sends `''` if not found.
- **The wire protocol is proprietary.** CommandCode may change it at any time;
  this plugin tracks the Provider API documented on commandcode.ai.
- **Subscription terms.** Using your CommandCode subscription through third-party
  clients is your responsibility — check your plan's terms.

## License

MIT

---

## Español

**Proveedor de Command Code para DeepSeek Harness.** Usa tu suscripción de
CommandCode (DeepSeek, Claude, GPT, Gemini y más de 30 modelos) como proveedor
de modelos dentro del arnés — instala, pega tu clave, elige un modelo y listo.
Escrito en TypeScript; el paquete incluye `lib/` ya compilado.

**Instalación:**

```sh
dsh plugin --profile web add dsh-llm-commandcode
```

**Uso:** Web UI → **Settings → Models** → tarjeta **Command Code** → pega tu
clave (`user_...`) → elige un modelo. O define `COMMANDCODE_API_KEY` como
variable de entorno.

**Cómo funciona (resumen):** el plugin traduce el idioma de CommandCode
(`/alpha/generate`, eventos SSE `text-delta`/`reasoning-delta`/`tool-call`/
`finish`) al idioma que DeepSeek Harness entiende (`StreamChunk`), con soporte
de razonamiento, herramientas, tokens de caché y errores estandarizados.

**Desarrollo:** `npm install` → `npm run build` → `COMMANDCODE_API_KEY=user_...
npm run test:standalone`.

**Limitaciones conocidas:** solo texto (sin imágenes por ahora); `off` puede no
desactivar el razonamiento si el backend piensa por defecto; el protocolo es
propietario de CommandCode y puede cambiar; revisa los términos de tu plan para
usar la suscripción con clientes de terceros.
