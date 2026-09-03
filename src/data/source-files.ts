import type { PackFile } from '../core/types';
import { sha256Hex } from './integrity';
import sources from './sources.json';

// The PDF copies of the source pages, rendered at build time by
// scripts/build-source-pdfs.mjs. Their names come from the register bundled
// with this code, never from a runtime read: an older service worker or HTTP
// cache can hand back an older register, and a pack must never be built
// against one. The files themselves are read from this origin only — the content
// security policy permits nothing else.

function fail(message: string): never {
  throw new TypeError(`source files: ${message}`);
}

/** One page's copy, read into memory, checked and hashed. Throws for a page
 *  the build did not render, so a pack never claims a copy it does not hold. */
async function readSourceFile(packId: string, url: string): Promise<PackFile> {
  const entry = sources.find((source) => source.url === url);
  if (!entry) fail(`no rendered copy of ${url}`);
  const response = await fetch(`/data/sources/${entry.name}`, { cache: 'force-cache' });
  if (!response.ok) fail(`${entry.name} request failed (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== '%PDF') fail(`${entry.name} is not a PDF`);
  return {
    id: `${packId}:${entry.name}`,
    packId,
    url,
    name: entry.name,
    retrievedAt: entry.retrievedAt,
    sizeBytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    bytes,
  };
}

/** The copies of the given pages, ready to be written with the pack. Nothing
 *  is written to the device here. */
export const loadSourceFiles = (packId: string, urls: string[]): Promise<PackFile[]> =>
  Promise.all(urls.map((url) => readSourceFile(packId, url)));
