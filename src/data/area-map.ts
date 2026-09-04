import { AREA_MAP_NAME, MAX_RESPONSE_BYTES, PACK_RADIUS_KM } from '../core/constants';
import type { LatLon, PackFile } from '../core/types';
import { readBodyBounded } from './bounded-body';
import { sha256Hex } from './integrity';

// The picture of a pack's own area, drawn by the Department of Transport and
// Planning's Web Map Service: the Designated Bushfire Prone Area over roads,
// water and locality names, PACK_RADIUS_KM each way from the saved place. It
// is fetched once, while the pack is built, and stored with the pack's other
// files so it opens with no signal; nothing fetches it after that.

const WMS_BASE_URL = 'https://opendata.maps.vic.gov.au/geoserver/wms';
const LAYERS = [
  'bushfire_prone_area',
  'vmlite_hy_water_area',
  'vmlite_tr_road',
  'vmlite_locality',
  'vmlite_geo_area_label',
].map((layer) => `open-data-platform:${layer}`).join(',');
const MAP_PX = 1024;
const KM_PER_DEGREE_LAT = 111;

/** The GetMap request for a square PACK_RADIUS_KM each way from the centre. A
 *  degree of longitude shrinks with latitude, so the east-west half-width is
 *  widened to keep the square square on the ground. */
export function areaMapUrl({ lat, lon }: LatLon): string {
  const halfLat = PACK_RADIUS_KM / KM_PER_DEGREE_LAT;
  const halfLon = halfLat / Math.cos((lat * Math.PI) / 180);
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetMap',
    styles: '',
    format: 'image/png',
    srs: 'EPSG:4326',
    bgcolor: '0xFFFFFF',
    layers: LAYERS,
    bbox: [lon - halfLon, lat - halfLat, lon + halfLon, lat + halfLat].join(','),
    width: String(MAP_PX),
    height: String(MAP_PX),
  });
  return `${WMS_BASE_URL}?${params}`;
}

/** The map, read into memory, checked and hashed, as one more file of the
 *  pack. Nothing is written to the device here. */
export async function loadAreaMap(packId: string, centre: LatLon): Promise<PackFile> {
  const url = areaMapUrl(centre);
  const response = await fetch(url);
  if (!response.ok) throw new TypeError(`area map: request failed (${response.status})`);
  const bytes = await readBodyBounded(response, MAX_RESPONSE_BYTES);
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
