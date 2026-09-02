import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALLOWED, BANNED } from '../../src/core/banned-terms';

// This runs the REAL scanner — the one `npm run verify` runs — over fixtures,
// rather than reimplementing the match here and drifting away from it.

const dirs: string[] = [];

const fixture = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cooeee-scan-'));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
};

const scan = (root: string): { code: number; output: string } => {
  try {
    const out = execFileSync('node', ['scripts/banned-terms.mjs', root], { encoding: 'utf8' });
    return { code: 0, output: out };
  } catch (e) {
    const err = e as { status: number; stderr: string; stdout: string };
    return { code: err.status, output: `${err.stdout}${err.stderr}` };
  }
};

afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('the banned-terms gate', () => {
  it('rejects every banned term, and names each one', () => {
    const body = BANNED.map((t, i) => `export const t${i} = ${JSON.stringify(t)};`).join('\n');
    const { code, output } = scan(fixture({ 'wording.ts': body }));

    expect(code).toBe(1);
    for (const term of BANNED) expect(output).toContain(`banned term "${term}"`);
  });

  it('accepts every allow-listed phrase, including the ones built from banned words', () => {
    const body = ALLOWED.map((t, i) => `export const a${i} = ${JSON.stringify(t)};`).join('\n');
    const { code } = scan(fixture({ 'allowed.ts': body }));
    expect(code).toBe(0);
  });

  it('matches on a word boundary, so an innocent longer word passes', () => {
    const { code } = scan(
      fixture({ 'boundary.ts': `export const s = 'a router and a safer crossing';` }),
    );
    expect(code).toBe(0);
  });

  it('reads inside template literals, where a banned word could otherwise hide', () => {
    const { code, output } = scan(
      fixture({ 'template.ts': 'export const s = (n: number) => `this ${n} is the best`;' }),
    );
    expect(code).toBe(1);
    expect(output).toContain('banned term "best"');
  });

  it('ignores module specifiers — an import path is not a promise to the user', () => {
    const { code } = scan(
      fixture({ 'imports.ts': `import { x } from './route-helpers';\nexport { x };` }),
    );
    expect(code).toBe(0);
  });

  it('reports the file and line so the hit can be found', () => {
    const { output } = scan(
      fixture({ 'located.ts': `export const ok = 'fine';\nexport const bad = 'all clear';` }),
    );
    expect(output).toMatch(/located\.ts:2/);
  });

  it('passes a directory with nothing to say', () => {
    expect(scan(fixture({ 'empty.ts': 'export const n = 1;' })).code).toBe(0);
  });
});

describe('the lists themselves', () => {
  it('bans the wordings that would turn absence into reassurance', () => {
    for (const term of ['safe', 'all clear', 'no risk', 'not designated', 'low risk']) {
      expect(BANNED).toContain(term);
    }
  });

  it('bans the wordings that would turn a bearing into a promise', () => {
    for (const term of ['route', 'directions', 'turn-by-turn', 'ETA', 'arrival']) {
      expect(BANNED).toContain(term);
    }
  });

  it('bans the wordings that would turn a may-match into an entitlement', () => {
    for (const term of ['eligible', 'entitled', 'guaranteed', 'you will receive']) {
      expect(BANNED).toContain(term);
    }
  });

  it('bans any wording that would rank the two saved places', () => {
    for (const term of ['best', 'recommended', 'preferred', 'primary', 'backup']) {
      expect(BANNED).toContain(term);
    }
  });

  it('allows only exact official phrases, and nothing open-ended', () => {
    expect(ALLOWED).toEqual([
      'Neighbourhood Safer Place',
      'Neighbourhood Safer Places',
      'sorted by distance — not a safety ranking',
      'Cooeee issues no warnings',
      'the responsible organisation decides who is eligible',
    ]);
  });
});
