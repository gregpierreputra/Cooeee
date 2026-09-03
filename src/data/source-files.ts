import type { PackFile } from '../core/types';
import { sha256Hex } from './integrity';

// The PDF copies of the source pages, rendered at build time by
// scripts/build-source-pdfs.mjs and served from this origin. Same-origin only:
// the content security policy permits nothing else, and the copy a pack holds
// is the one the build made, never a page fetched live.

const INDEX_PATH = '/data/index.json';

type SourceEntry = { url: string; name: string; retrievedAt: number };

/** A plain PDF file name: it becomes a request path and a download name. */
const FILE_NAME = /^[\w.-]+\.pdf$/;

function fail(message: string): never {
  throw new TypeError(`source files: ${message}`);
}

/** The build's register of rendered pages, checked field by field. */
async function readSourceEntries(fetchImpl: typeof fetch): Promise<SourceEntry[]> {
  const response = await fetchImpl(INDEX_PATH, { cache: 'force-cache' });
  if (!response.ok) fail(`index request failed (${response.status})`);
  const { sources } = (await response.json()) as { sources?: unknown };
  if (!Array.isArray(sources)) fail('index.json lists no sources');
  return sources.map((entry: Record<string, unknown>) => {
    if (typeof entry.url !== 'string' || typeof entry.name !== 'string'
      || !FILE_NAME.test(entry.name) || typeof entry.retrievedAt !== 'number') {
      fail('a source entry is malformed');
    }
    return { url: entry.url, name: entry.name, retrievedAt: entry.retrievedAt };
  });
}

/** One page's copy, read into memory, checked and hashed. */
async function readSourceFile(
  packId: string,
  entry: SourceEntry,
  fetchImpl: typeof fetch,
): Promise<PackFile> {
  const response = await fetchImpl(`/data/sources/${entry.name}`, { cache: 'force-cache' });
  if (!response.ok) fail(`${entry.name} request failed (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== '%PDF') fail(`${entry.name} is not a PDF`);
  return {
    id: `${packId}:${entry.name}`,
    packId,
    url: entry.url,
    name: entry.name,
    retrievedAt: entry.retrievedAt,
    sizeBytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    bytes,
  };
}

/** The copies of the given pages, ready to be written with the pack. Throws
 *  for a page the build did not render, so a pack never claims a copy it
 *  does not hold. Nothing is written to the device here. */
export async function loadSourceFiles(
  packId: string,
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<PackFile[]> {
  const entries = await readSourceEntries(fetchImpl);
  return Promise.all(urls.map((url) => {
    const entry = entries.find((candidate) => candidate.url === url);
    if (!entry) fail(`no rendered copy of ${url}`);
    return readSourceFile(packId, entry, fetchImpl);
  }));
}
