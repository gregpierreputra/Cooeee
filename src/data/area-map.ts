import {
  AREA_MAP_HALF_KM,
  AREA_MAP_NAME,
  AREA_MAP_TIMEOUT_MS,
} from '../core/constants';
import { mapBoxAround } from '../core/area-map-view';
import type { LatLon, PackFile } from '../core/types';
import { readBodyBounded } from './bounded-body';
import { sha256Hex } from './integrity';

// The picture of a pack's own area, drawn by the Department of Transport and
// Planning's Web Map Service: the Designated Bushfire Prone Area under roads,
// creeks, rail, and place and peak names, AREA_MAP_HALF_KM each way from the
// saved place (forest and built-up fills are left out: they paint over it). It
// is fetched once, while the pack is built, and stored with the pack's other
// files so it opens with no signal; nothing fetches it after that.

const WMS_BASE_URL = 'https://opendata.maps.vic.gov.au/geoserver/wms';
const LAYERS = [
  'bushfire_prone_area',
  'vmlite_hy_water_area',
  'vmlite_hy_watercourse',
  'vmlite_tr_rail',
  'vmlite_tr_road',
  'vmlite_tr_rail_station',
  'vmlite_locality',
  'vmlite_geo_area_label',
  'vmlite_geo_point_label',
].map((layer) => `open-data-platform:${layer}`).join(',');
// The sizes tried in turn, sharpest first, as [pixels, dpi]: about 5, 6.5 and
// 10 m a pixel over the 40 km square. The service draws lines and labels at a
// fixed pixel size, so the dpi grows with the pixels: the labels keep their
// size and the picture is simply sharper.
const MAP_SIZES = [
  [8192, 360],
  [6144, 270],
  [4096, 180],
] as const;

/** The GetMap request for a square AREA_MAP_HALF_KM each way from the centre. */
export function areaMapUrl(centre: LatLon, px: number, dpi: number): string {
  const { west, south, east, north } = mapBoxAround(centre, AREA_MAP_HALF_KM);
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetMap',
    styles: '',
    format: 'image/png',
    srs: 'EPSG:4326',
    bgcolor: '0xFFFFFF',
    format_options: `dpi:${dpi}`,
    layers: LAYERS,
    bbox: [west, south, east, north].join(','),
    width: String(px),
    height: String(px),
  });
  return `${WMS_BASE_URL}?${params}`;
}

/** The map, read into memory, checked and hashed, as one more file of the
 *  pack. The sharpest size that fits in maxBytes is kept: a picture too big
 *  for the pack's budget falls back to the next size. Any other failure ends
 *  the attempt at once, so a slow or broken service never costs three waits.
 *  Nothing is written to the device here. */
export async function loadAreaMap(packId: string, centre: LatLon, maxBytes: number): Promise<PackFile> {
  for (const [px, dpi] of MAP_SIZES) {
    const url = areaMapUrl(centre, px, dpi);
    const response = await fetch(url, { signal: AbortSignal.timeout(AREA_MAP_TIMEOUT_MS) });
    if (!response.ok) throw new TypeError(`area map: request failed (${response.status})`);
    let bytes: ArrayBuffer;
    try {
      bytes = await readBodyBounded(response, maxBytes);
    } catch (error) {
      if (error instanceof RangeError) continue; // too big for the pack: try smaller
      throw error;
    }
    // The service answers a bad request with an XML message and status 200, so
    // the picture is checked by its own signature: one non-text byte, then PNG.
    if (new TextDecoder().decode(bytes.slice(1, 4)) !== 'PNG') throw new TypeError('area map: not a PNG');
    return {
      id: `${packId}:${AREA_MAP_NAME}`,
      packId,
      url,
      name: AREA_MAP_NAME,
      retrievedAt: Date.now(),
      sizeBytes: bytes.byteLength,
      sha256: await sha256Hex(bytes),
      bytes,
    };
  }
  throw new RangeError('area map: no size fits the pack');
}
