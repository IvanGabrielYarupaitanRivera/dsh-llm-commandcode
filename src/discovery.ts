// discovery.ts — answer "which models can CommandCode serve?" for the
// configuration surface (Settings → Models → Fetch available models).
//
// The CommandCode Provider API lists models at GET {base}/provider/v1/models
// with bearer auth. The listing shape is parsed defensively: an array, a
// {data: [...]} wrapper, or a {models: [...]} wrapper are all accepted, and
// entries without a usable id are skipped.

import { LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmDiscoveredModel, LlmModelDiscoveryRequest } from '@deepseek-ai/dsh-llm'

export async function discoverModels(
  request: LlmModelDiscoveryRequest,
  getBaseURL: () => string,
): Promise<readonly LlmDiscoveredModel[]> {
  const baseURL = (request.baseURL ?? getBaseURL()).replace(/\/+$/, '')
  if (baseURL === '') {
    throw new LlmError('commandcode: discovery needs a base URL', 'DISCOVERY_FAILED')
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (request.apiKey !== undefined) headers.authorization = `Bearer ${request.apiKey}`

  let response: Response
  try {
    response = await fetch(`${baseURL}/provider/v1/models`, {
      headers,
      signal: request.signal,
    })
  } catch (error) {
    throw new LlmError(
      `commandcode: model listing failed: ${error instanceof Error ? error.message : String(error)}`,
      'DISCOVERY_FAILED',
    )
  }
  if (!response.ok) {
    throw new LlmError(
      `commandcode: model listing failed with HTTP ${response.status}`,
      response.status === 401 || response.status === 403 ? 'AUTH' : 'DISCOVERY_FAILED',
      { status: response.status },
    )
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new LlmError('commandcode: model listing is not JSON', 'DISCOVERY_FAILED')
  }
  const record = json as Record<string, unknown> | null
  const list = Array.isArray(json)
    ? json
    : Array.isArray(record?.data)
      ? record?.data
      : Array.isArray(record?.models)
        ? record?.models
        : undefined
  if (!Array.isArray(list)) {
    throw new LlmError('commandcode: model listing has no data array', 'DISCOVERY_FAILED')
  }

  return list
    .map((entry): LlmDiscoveredModel | undefined => {
      const id = typeof entry === 'string' ? entry : (entry as Record<string, unknown> | null)?.id
      return typeof id === 'string' && id.length > 0 ? { id } : undefined
    })
    .filter((entry): entry is LlmDiscoveredModel => entry !== undefined)
}
