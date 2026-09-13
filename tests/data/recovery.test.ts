import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

import { assertRecoverySnapshot, loadRecoveryPrograms } from '../../src/data/recovery';
import { db } from '../../src/data/db';
import { program } from '../fixtures';

const wire = (programs: unknown[]): unknown =>
  JSON.parse(JSON.stringify({ snapshotDate: '2026-09-11', retrievedAt: 1, programs }));

describe('assertRecoverySnapshot', () => {
  it('parses a well-formed snapshot', () => {
    expect(assertRecoverySnapshot(wire([program()]))).toHaveLength(1);
  });

  it('refuses a program with no need, an off-domain page, or a malformed telephone', () => {
    expect(() => assertRecoverySnapshot(wire([program({ needs: [] })]))).toThrow(/needs/);
    expect(() => assertRecoverySnapshot(wire([program({ officialUrl: 'https://example.com/' })])))
      .toThrow(/official domain/);
    expect(() => assertRecoverySnapshot(wire([program({ officialUrl: 'javascript:alert(1)' })])))
      .toThrow(/official domain/);
    expect(() => assertRecoverySnapshot(wire([program({ telephone: '1800 CALL' })]))).toThrow(/telephone/);
    expect(() => assertRecoverySnapshot(wire([]))).toThrow(/non-empty/);
  });
});

describe('loadRecoveryPrograms', () => {
  it('stores the rows it returns, so the pack build can read them back by id', async () => {
    await db.programs.clear();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(wire([program()])), { status: 200 }));
    const rows = await loadRecoveryPrograms(fetchImpl as unknown as typeof fetch);
    expect(rows.map((row) => row.id)).toEqual(['prog-1']);
    expect(await db.programs.get('prog-1')).toMatchObject({ org: 'Services Australia' });
  });

  it('replaces the table whole, so an older snapshot never lingers beside the current one', async () => {
    await db.programs.put(program({ id: 'old' }));
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(wire([program()])), { status: 200 }));
    await loadRecoveryPrograms(fetchImpl as unknown as typeof fetch);
    expect((await db.programs.toArray()).map((row) => row.id)).toEqual(['prog-1']);
  });
});
