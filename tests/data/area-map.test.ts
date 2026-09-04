import { afterEach, describe, expect, it, vi } from 'vitest';
import { AREA_MAP_NAME, PACK_RADIUS_KM } from '../../src/core/constants';
import { areaMapUrl, loadAreaMap } from '../../src/data/area-map';

const centre = { lat: -37.8, lon: 145.3 };
const serve = (body: BodyInit) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
afterEach(() => vi.unstubAllGlobals());

describe('areaMapUrl', () => {
  it('asks for a square PACK_RADIUS_KM each way from the centre', () => {
    const bbox = new URL(areaMapUrl(centre)).searchParams.get('bbox') ?? '';
    const [west, south, east, north] = bbox.split(',').map(Number);
    const eastWestKm = (east - west) * 111 * Math.cos((centre.lat * Math.PI) / 180);
    expect((north - south) * 111).toBeCloseTo(PACK_RADIUS_KM * 2, 6);
    expect(eastWestKm).toBeCloseTo(PACK_RADIUS_KM * 2, 6);
    expect((north + south) / 2).toBeCloseTo(centre.lat, 9);
    expect((east + west) / 2).toBeCloseTo(centre.lon, 9);
  });
});

describe('loadAreaMap', () => {
  it('refuses a body that is not a PNG, whatever the status says', async () => {
    serve('<ServiceExceptionReport>bad bbox</ServiceExceptionReport>');
    await expect(loadAreaMap('pack-1', centre)).rejects.toThrow(/not a PNG/);
  });

  it('stores a PNG under the map name, with its size and fingerprint', async () => {
    serve(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const file = await loadAreaMap('pack-1', centre);
    expect(file.name).toBe(AREA_MAP_NAME);
    expect(file.id).toBe(`pack-1:${AREA_MAP_NAME}`);
    expect(file.sizeBytes).toBe(8);
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
