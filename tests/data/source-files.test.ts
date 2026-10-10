import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPackFiles, loadSourceFiles } from '../../src/data/source-files';
import sources from '../../src/data/sources.json';
import { AREA_MAP_NAME } from '../../src/core/constants';
import { destination, pack, packProgram } from '../fixtures';

// The register bundled with the app names each rendered page and its
// fingerprint. Whatever the origin serves is checked against that fingerprint.
const [entry] = sources;
const serve = (body: BodyInit) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
afterEach(() => vi.unstubAllGlobals());

describe('loadSourceFiles', () => {
  it('accepts the copy the build recorded, with its fingerprint', async () => {
    const bytes = readFileSync(`public/data/sources/${entry.name}`);
    serve(bytes);
    const [file] = await loadSourceFiles('pack-1', [entry.url]);
    expect(file.sha256).toBe(entry.sha256);
    expect(file.sizeBytes).toBe(bytes.byteLength);
  });

  it('refuses a PDF whose bytes do not match the recorded fingerprint', async () => {
    serve('%PDF-1.7 substituted');
    await expect(loadSourceFiles('pack-1', [entry.url])).rejects.toThrow(/does not match/);
  });
});

describe('loadPackFiles', () => {
  it('builds without the map when the map cannot be read, so a map outage never stops a pack', async () => {
    const datasetPage = sources[1]; // the page every pack carries
    // Every request is answered with that PDF: the page passes its fingerprint
    // check, and the map request fails its PNG check.
    serve(readFileSync(`public/data/sources/${datasetPage.name}`));
    const files = await loadPackFiles('pack-1', { pack: pack(), layers: [], destinations: [], recovery: [] });
    expect(files.map((file) => file.name)).toEqual([datasetPage.name]);
  });

  it('widens the map to take in a chosen place past the usual 20 km', async () => {
    const datasetPage = sources[1];
    const pdf = readFileSync(`public/data/sources/${datasetPage.name}`);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      new Response(String(url).includes('/geoserver/wms') ? png : pdf, { status: 200 })));
    const home = pack();
    // 0.4 degrees north is about 44 km: the map reaches 48 km each way, 96 across.
    const base = destination();
    const far = destination({ lat: home.lat + 0.4, lon: home.lon, source: { ...base.source, url: datasetPage.url } });
    const files = await loadPackFiles('pack-1', { pack: home, layers: [], destinations: [far], recovery: [] });
    const map = files.find((file) => file.name === AREA_MAP_NAME)!;
    const [, south, , north] = (new URL(map.url).searchParams.get('bbox') ?? '').split(',').map(Number);
    expect(Math.round((north - south) * 111)).toBe(96);
  });

  it('carries a kept program\'s page where the build rendered one, and skips one it did not', async () => {
    const datasetPage = sources[1];
    serve(readFileSync(`public/data/sources/${datasetPage.name}`));
    const rendered = packProgram({ officialUrl: datasetPage.url });
    const linkOnly = packProgram({ id: 'pack-1:link', programId: 'link', officialUrl: 'https://www.redcross.org.au/' });
    const files = await loadPackFiles('pack-1', { pack: pack(), layers: [], destinations: [], recovery: [rendered, linkOnly] });
    expect(files.map((file) => file.name)).toEqual([datasetPage.name]);
  });
});
