import { describe, expect, it } from 'vitest';
import { checkGate } from '../../server/gate';

describe('the development gate', () => {
  const secret = 'right';
  const t = 1_000_000;

  it('opens on the password and answers 503 when no password is configured', () => {
    expect(checkGate(secret, '203.0.113.1', 'right', t).status).toBe(200);
    expect(checkGate(undefined, '203.0.113.1', 'right', t).status).toBe(503);
    expect(checkGate(secret, '203.0.113.1', 42, t).status).toBe(400);
  });

  it('locks an address for 30 to 60 seconds after three misses, then lets it try again', () => {
    const ip = '203.0.113.2';
    expect(checkGate(secret, ip, 'wrong', t)).toEqual({ status: 401, body: { error: 'incorrect', attemptsLeft: 2 } });
    expect(checkGate(secret, ip, 'wrong', t)).toEqual({ status: 401, body: { error: 'incorrect', attemptsLeft: 1 } });
    const third = checkGate(secret, ip, 'wrong', t) as { status: number; body: { retryAfterSeconds: number } };
    expect(third.status).toBe(429);
    expect(third.body.retryAfterSeconds).toBeGreaterThanOrEqual(30);
    expect(third.body.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(checkGate(secret, ip, 'right', t + 1000).status).toBe(429);
    expect(checkGate(secret, '203.0.113.3', 'right', t + 1000).status).toBe(200);
    expect(checkGate(secret, ip, 'right', t + 61_000).status).toBe(200);
  });
});
