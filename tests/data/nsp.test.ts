import { describe, expect, it, vi } from 'vitest';

import { assertNspSnapshot, loadNspSnapshot, NSP_SNAPSHOT_PATH } from '../../src/data/nsp';
import { nspSite, nspSnapshot } from '../fixtures';

/** A snapshot as it would arrive over the wire — a plain JSON round-trip, so a
 *  test can never accidentally pass a live object reference into the parser. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const okResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('assertNspSnapshot', () => {
  it('parses a well-formed snapshot', () => {
    const parsed = assertNspSnapshot(wire(nspSnapshot()));
    expect(parsed.listAsAt).toBe('2026-08-18');
    expect(parsed.sites).toHaveLength(1);
    expect(parsed.source.publisher).toBe('Country Fire Authority');
  });

  it('throws when the file is not an object', () => {
    expect(() => assertNspSnapshot(null)).toThrow(/must be a JSON object/);
    expect(() => assertNspSnapshot('[]')).toThrow(/must be a JSON object/);
  });

  it('throws when listAsAt is missing or not an ISO date', () => {
    expect(() => assertNspSnapshot(wire(nspSnapshot({ listAsAt: undefined as never })))).toThrow(
      /listAsAt/,
    );
    expect(() => assertNspSnapshot(wire(nspSnapshot({ listAsAt: '18 Aug 2026' })))).toThrow(
      /ISO date/,
    );
  });

  it('throws when retrievedAt is missing or not positive', () => {
    expect(() => assertNspSnapshot(wire(nspSnapshot({ retrievedAt: 0 })))).toThrow(/retrievedAt/);
  });

  it('throws when the file Source has no licence', () => {
    const snapshot = nspSnapshot();
    const broken = { ...snapshot, source: { ...snapshot.source, licence: '' } };
    expect(() => assertNspSnapshot(wire(broken))).toThrow(/source\.licence/);
  });

  it('throws when sites is not an array', () => {
    expect(() => assertNspSnapshot(wire(nspSnapshot({ sites: 'nope' as never })))).toThrow(
      /sites must be an array/,
    );
  });

  it('throws when a site is missing its council', () => {
    const snapshot = nspSnapshot({ sites: [{ ...nspSite(), municipality: '' }] });
    expect(() => assertNspSnapshot(wire(snapshot))).toThrow(/sites\[0\]\.municipality/);
  });

  it('throws when a located site has a non-numeric coordinate', () => {
    const snapshot = nspSnapshot({ sites: [{ ...nspSite(), lat: 'south' as never }] });
    expect(() => assertNspSnapshot(wire(snapshot))).toThrow(/sites\[0\]\.lat/);
  });

  it("throws when a geocode:'none' site still carries coordinates", () => {
    const snapshot = nspSnapshot({
      sites: [{ ...nspSite(), geocode: 'none', lat: -37.8, lon: 145.3 }],
    });
    expect(() => assertNspSnapshot(wire(snapshot))).toThrow(/must not carry coordinates/);
  });

  it('throws on an unknown geocode value', () => {
    const snapshot = nspSnapshot({ sites: [{ ...nspSite(), geocode: 'approximate' as never }] });
    expect(() => assertNspSnapshot(wire(snapshot))).toThrow(/geocode/);
  });
});

describe('loadNspSnapshot', () => {
  it('requests exactly the precached same-origin snapshot path, with no query string', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => okResponse(wire(nspSnapshot())));
    await loadNspSnapshot(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = fetchImpl.mock.calls[0][0];
    expect(url).toBe(NSP_SNAPSHOT_PATH);
    expect(String(url)).not.toContain('?');
  });

  it('runs the bytes through the asserting parser', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      okResponse(wire(nspSnapshot({ sites: 'nope' as never }))));
    await expect(loadNspSnapshot(fetchImpl)).rejects.toThrow(/sites must be an array/);
  });

  it('throws when the file could not be read', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => ({ ok: false, status: 404 }) as unknown as Response,
    );
    await expect(loadNspSnapshot(fetchImpl)).rejects.toThrow(/request failed \(404\)/);
  });
});
