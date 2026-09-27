// The locality names for BlackSky's map disc (BS_Enhancement-AC5), read from
// the service worker's precache and nowhere else, like the roads file (see
// ./roads.ts). No fetch here, on purpose, and the linter holds this file to
// that (RULE 2 in eslint.config.js): what is not already held is not shown.

export const LOCALITIES_PATH = '/data/localities-vic.json';

/** The file's parsed JSON, or undefined when this phone does not hold it. The
 *  rows are checked by decodeLocalities in core/localities.ts. */
export async function readLocalitiesFile(): Promise<unknown> {
  if (typeof caches === 'undefined') return undefined;
  const held = await caches.match(LOCALITIES_PATH, { ignoreSearch: true });
  return held ? held.json() : undefined;
}
