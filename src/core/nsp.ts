import { absenceRow } from './destination';
import { withinRadius } from './geo';
import * as copy from './copy';
import type { Destination, LatLon, NspSite, NspSnapshot } from './types';

// The council names in the CFA list carry a governance suffix ("Yarra Ranges
// Shire") that a pack's lgaName ("YARRA RANGES") does not, and either side may
// use the "City of X" / "X City" form. Compare on the bare name.
const LGA_SUFFIXES = /\b(SHIRE COUNCIL|CITY COUNCIL|RURAL CITY|SHIRE|CITY|BOROUGH)\b/g;

const normaliseLga = (name: string): string =>
  name
    .toUpperCase()
    .replace(/^CITY OF /, '')
    .replace(LGA_SUFFIXES, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Whether a CFA site's council is the pack's LGA. Used to scope an un-located
 *  site to the right area by council name — never by a guessed coordinate. */
export const sameLga = (municipality: string, lgaName: string): boolean => {
  const a = normaliseLga(municipality);
  return a.length > 0 && a === normaliseLga(lgaName);
};

const isLocated = (site: NspSite): boolean =>
  site.geocode !== 'none' && typeof site.lat === 'number' && typeof site.lon === 'number';

/** The CFA sites to show for one pack: those published within `radiusKm` of the
 *  pack centre, and separately those the CFA lists for the pack's council but
 *  could not place on the map.
 *
 *  The radius is never widened when the result is empty, and the list is never
 *  joined to any other data — a park or hall from the basemap has no path in. */
export const selectSitesForPack = (
  sites: NspSite[],
  centre: LatLon,
  lgaName: string,
  radiusKm: number,
): { located: NspSite[]; unlocated: NspSite[] } => ({
  located: sites.filter(
    (site) => isLocated(site) && withinRadius(centre, { lat: site.lat!, lon: site.lon! }, radiusKm),
  ),
  unlocated: sites.filter((site) => !isLocated(site) && sameLga(site.municipality, lgaName)),
});

const composeAddress = (site: NspSite): string =>
  [site.street, site.subLocation, site.township]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(', ');

/** One CFA site → one DESTINATION row. Straight-line distance and the ordinal
 *  are added later by core/destination.ts, so an un-located site simply never
 *  gets them. The row carries the snapshot's own Source; core never invents
 *  provenance. `kind` is always 'nsp-bushfire' — an absence row is a different
 *  path entirely. */
export const toDestination = (
  site: NspSite,
  packId: string,
  snapshot: Pick<NspSnapshot, 'listAsAt' | 'source'>,
): Destination => ({
  id: `${packId}:${site.id}`,
  packId,
  kind: 'nsp-bushfire',
  name: site.name,
  addressText: composeAddress(site),
  council: site.municipality,
  listAsAt: snapshot.listAsAt,
  geocode: site.geocode,
  ...(isLocated(site) ? { lat: site.lat, lon: site.lon } : {}),
  source: snapshot.source,
});

/** '18 Aug 2026' from '2026-08-18'. Parsed as a bare calendar date with no time
 *  zone, because the list's "as at" date carries neither. This is deliberately
 *  not provenance.formatSavedDate, which formats an instant in Melbourne time. */
export const formatIsoDateShort = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new TypeError(`not an ISO date: ${JSON.stringify(iso)}`);
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

/** The mandated per-entry date line: the list's own date, labelled as the list's
 *  date. A per-site date would be a provenance fabrication. */
export const nspListDateLabel = (listAsAt: string): string =>
  copy.NSP_LIST_AS_AT(formatIsoDateShort(listAsAt));

/** The destination rows to persist for a pack. When the CFA list yields nothing
 *  for the area — no site in range and none listed for the council — the pack
 *  still carries ONE row: the absence marker, with its reason and the area it
 *  applies to. Absence is a row, never an empty array, so PackDetail and
 *  BlackSky read the same truth. The radius is never widened and no place from a
 *  neighbouring council is ever substituted — that is already true of
 *  `selectSitesForPack`; this function just never papers over its empty result. */
export const destinationsForPack = (
  selection: { located: NspSite[]; unlocated: NspSite[] },
  packId: string,
  snapshot: Pick<NspSnapshot, 'listAsAt' | 'source'>,
  area: string,
): Destination[] =>
  selection.located.length === 0 && selection.unlocated.length === 0
    ? [absenceRow(packId, area, snapshot.source)]
    : [
        ...selection.located.map((site) => toDestination(site, packId, snapshot)),
        ...selection.unlocated.map((site) => toDestination(site, packId, snapshot)),
      ];
