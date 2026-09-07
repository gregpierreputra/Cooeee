import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPackFiles, loadSourceFiles } from '../../src/data/source-files';
import sources from '../../src/data/sources.json';
import { pack } from '../fixtures';

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
});
