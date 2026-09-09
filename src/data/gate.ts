import { readJsonBounded } from './bounded-body';

const GATE_PATH = '/api/v1/gate';
const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1024;

export type GateAnswer = { status: number; body: { attemptsLeft?: number; retryAfterSeconds?: number } };

/** Asks the server whether this password opens the gate. The password goes
 *  out once, over the same origin, and is never stored on the device. */
export async function postGate(password: string, fetcher: typeof fetch = fetch): Promise<GateAnswer> {
  const response = await fetcher(GATE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await readJsonBounded(response, MAX_RESPONSE_BYTES)) as GateAnswer['body'];
  return { status: response.status, body };
}
