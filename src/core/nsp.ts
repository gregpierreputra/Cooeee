import { absenceRow } from './destination';
import { distanceM } from './geo';
import * as copy from './copy';
import type { Destination, HazardType, LatLon, NspSite, NspSnapshot } from './types';

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

/** The CFA sites to show for one pack: the `count` nearest to the pack centre,
 *  state-wide and however far, and separately those the CFA lists for the
 *  pack's council but could not place on the map.
 *
 *  Distance is the only rule — no radius, no council line — and the list is
 *  never joined to any other data: a park or hall from the basemap has no path
 *  in. The sort is stable, so equal distances keep the list's own order.
 *
 *  Neighbourhood Safer Places are a bushfire concept: for a flood or heat pack
 *  this returns nothing at all, whatever the snapshot holds. */
export const selectSitesForPack = (
  sites: NspSite[],
  centre: LatLon,
  lgaName: string,
  count: number,
  hazard: HazardType = 'bushfire',
): { located: NspSite[]; unlocated: NspSite[] } => {
  if (hazard !== 'bushfire') return { located: [], unlocated: [] };
  // Measure each site once, then sort on the stored figure.
  const measured = sites
    .filter(isLocated)
    .map((site) => ({ site, metres: distanceM(centre, { lat: site.lat!, lon: site.lon! }) }))
    .sort((a, b) => a.metres - b.metres);
  return {
    located: measured.slice(0, count).map(({ site }) => site),
    unlocated: sites.filter((site) => !isLocated(site) && sameLga(site.municipality, lgaName)),
  };
};

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
  ...(site.designatedAt ? { designatedAt: site.designatedAt } : {}),
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
 *  date. A site's own designation date is shown separately, only when recorded. */
export const nspListDateLabel = (listAsAt: string): string =>
  copy.NSP_LIST_AS_AT(formatIsoDateShort(listAsAt));

/** The destination rows to persist for a pack.
 *
 *  A flood or heat pack gets NONE — no places and no absence marker, because an
 *  NSP-shaped absence row would itself be offering a bushfire-only concept.
 *
 *  For a bushfire pack: when nothing was chosen — no located site on the
 *  list, or only sites that could not be placed — the pack still carries ONE
 *  row, the
 *  absence marker, with its reason and the area it applies to. Absence is a
 *  row, never an empty array, so PackDetail and BlackSky read the same truth.
 *  Otherwise the pack carries exactly the places the user chose (`chosen`) —
 *  never the whole list, never a neighbouring council, never a widened radius. */
export const destinationsForPack = (
  chosen: Destination[],
  packId: string,
  snapshot: Pick<NspSnapshot, 'listAsAt' | 'source'>,
  area: string,
  hazard: HazardType = 'bushfire',
): Destination[] => {
  if (hazard !== 'bushfire') return [];
  return chosen.length === 0 ? [absenceRow(packId, area, snapshot.source)] : chosen;
};
