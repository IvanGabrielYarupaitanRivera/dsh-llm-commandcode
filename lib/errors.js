// errors.ts — map CommandCode failures to stable harness LlmError codes.
import { LlmError } from '@deepseek-ai/dsh-llm';
/** Build the LlmError for a non-2xx provider response. */
export function httpError(status, bodyText) {
    const message = bodyText || `commandcode: HTTP ${status}`;
    const options = { status };
    if (status === 401 || status === 403)
        return new LlmError(message, 'AUTH', options);
    if (status === 429) {
        return new LlmError(message, /quota|balance|credit/i.test(message) ? 'QUOTA' : 'RATE_LIMIT', options);
    }
    if (status === 400) {
        const code = /context|token|window|length/i.test(message)
            ? 'CONTEXT_WINDOW_EXCEEDED'
            : /quota|balance|credit/i.test(message)
                ? 'QUOTA'
                : 'INVALID_REQUEST';
        return new LlmError(message, code, options);
    }
    if (status >= 500)
        return new LlmError(message, 'SERVER', options);
    return new LlmError(message, `HTTP_${status}`, options);
}
/** Classify a fetch failure (DNS, refused connection, TLS, proxy). */
export function classifyTransportError(error, baseURL, callerAborted) {
    if (callerAborted())
        return new LlmError('commandcode: aborted by caller', 'ABORTED', { cause: asError(error) });
    if (error instanceof Error && error.name === 'TimeoutError') {
        return new LlmError('commandcode: stream idle timeout', 'TIMEOUT', { cause: error });
    }
    return new LlmError(`commandcode: request to ${baseURL} failed`, 'TRANSPORT', { cause: asError(error) });
}
/** Classify a body-read failure; keeps an already-mapped LlmError as-is. */
export function classifyReadError(error, callerAborted) {
    if (callerAborted())
        return new LlmError('commandcode: aborted by caller', 'ABORTED', { cause: asError(error) });
    if (error instanceof Error && error.name === 'TimeoutError') {
        return new LlmError('commandcode: stream idle timeout', 'TIMEOUT', { cause: error });
    }
    if (error instanceof LlmError)
        return error;
    return new LlmError(`commandcode: stream read failed: ${error instanceof Error ? error.message : String(error)}`, 'TRANSPORT', { cause: asError(error) });
}
function asError(error) {
    return error instanceof Error ? error : undefined;
}
