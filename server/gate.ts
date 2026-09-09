import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Route } from './api.ts';

const TRIES = 3;
const LOCK_MIN_MS = 30_000;
const LOCK_MAX_MS = 60_000;
const MAX_PASSWORD_LENGTH = 128;
const attempts = new Map<string, { failures: number; lockedUntil: number }>();

// Hashing both sides first gives timingSafeEqual the equal-length inputs it
// requires, so a wrong length leaks nothing either.
const sha256 = (text: string): Buffer => createHash('sha256').update(text).digest();

/** The development gate (feature 1): one password held only in GATE_PASSWORD,
 *  three tries per address, then a random 30 to 60 second lockout. A missing
 *  secret answers 503 rather than letting anyone through. */
export function checkGate(secret: string | undefined, ip: string, password: unknown, now: number): Route {
  if (!secret) return { status: 503, body: { error: 'unavailable' } };
  // ponytail: clear every entry rather than expire each one; bounds memory under address spoofing.
  if (attempts.size > 10_000) attempts.clear();
  const entry = attempts.get(ip) ?? { failures: 0, lockedUntil: 0 };
  if (now < entry.lockedUntil) return locked(entry.lockedUntil - now);
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    return { status: 400, body: { error: 'bad request' } };
  }
  if (timingSafeEqual(sha256(password), sha256(secret))) {
    attempts.delete(ip);
    return { status: 200, body: { ok: true } };
  }
  const failures = entry.failures + 1;
  if (failures < TRIES) {
    attempts.set(ip, { failures, lockedUntil: 0 });
    return { status: 401, body: { error: 'incorrect', attemptsLeft: TRIES - failures } };
  }
  const lockMs = randomInt(LOCK_MIN_MS, LOCK_MAX_MS + 1);
  attempts.set(ip, { failures: 0, lockedUntil: now + lockMs });
  return locked(lockMs);
}

function locked(remainingMs: number): Route {
  return { status: 429, body: { error: 'locked', retryAfterSeconds: Math.ceil(remainingMs / 1000) } };
}

/** A JSON request body of at most maxBytes. Throws on an oversized or
 *  malformed body; the caller answers 400. */
export async function readJson(request: IncomingMessage, maxBytes = 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      request.destroy();
      throw new RangeError(`request body exceeds ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
