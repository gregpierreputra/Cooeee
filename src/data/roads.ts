// The roads file for BlackSky's dial (BS_Enhancement-AC5), read from the
// service worker's precache and nowhere else. It is precached with the app
// shell like the other snapshots under public/data, so it is on the phone from
// the first visit that had a connection.
//
// No fetch here, on purpose, and the linter holds this file to that (see
// RULE 2 in eslint.config.js): a fetch that missed the cache would go to the
// network, and BlackSky makes no network call. Cache Storage is read directly;
// what is not already held is simply not shown.

export const ROADS_PATH = '/data/roads-vic.bin';

/** The file's bytes, or undefined when this phone does not hold it: no cache
 *  support, a first visit that never finished precaching, or a cleared cache.
 *  The precache keys a file by its URL plus a revision query, so the query is
 *  ignored when matching. */
export async function readRoadsFile(): Promise<ArrayBuffer | undefined> {
  if (typeof caches === 'undefined') return undefined;
  const held = await caches.match(ROADS_PATH, { ignoreSearch: true });
  return held ? held.arrayBuffer() : undefined;
}
