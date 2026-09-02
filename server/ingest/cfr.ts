import type { Db } from '../db.ts';
import { runSync } from '../sources.ts';
import { type FacilityInput, rebuildNearestStatic, upsertFacilities } from './static.ts';

export const SOURCE_ID = 'cfr_static_list';

// The five Community Fire Refuges prescribed in the CFA Regulations 2025, from
// https://www.cfa.vic.gov.au/plan-prepare/your-local-area-info-and-advice/community-fire-refuges
// (page dated 28 April 2026). Coordinates are the Vicmap Address points for the
// listed street addresses, looked up on 2 September 2026. Ferny Creek lists no
// street number and Lavers Hill's 8-14 range has no single address point, so
// the nearest address point on that road is used. Review yearly against the page.
export const CFR_SITES: FacilityInput[] = [
  {
    externalRef: 'cfr-east-warburton',
    typeCode: 'CFR',
    name: 'East Warburton Community Fire Refuge',
    address: 'Millwarra Primary School East Warburton Campus (Library and Learning Centre), 397 Woods Point Road, East Warburton 3799',
    lat: -37.742062,
    lon: 145.735954,
    lgaName: 'Yarra Ranges',
  },
  {
    externalRef: 'cfr-ferny-creek',
    typeCode: 'CFR',
    name: 'Ferny Creek Community Fire Refuge',
    address: 'Ferny Creek Primary School (Library and Learning Centre), School Road, Ferny Creek 3786',
    lat: -37.88323,
    lon: 145.333062,
    lgaName: 'Yarra Ranges',
  },
  {
    externalRef: 'cfr-millgrove',
    typeCode: 'CFR',
    name: 'Millgrove Community Fire Refuge',
    address: 'Wesburn-Millgrove CFA Fire Station, 3060 Warburton Highway, Millgrove 3799',
    lat: -37.754593,
    lon: 145.654275,
    lgaName: 'Yarra Ranges',
  },
  {
    externalRef: 'cfr-blackwood',
    typeCode: 'CFR',
    name: 'Blackwood Community Fire Refuge',
    address: 'Blackwood CFA Fire Station, 2 Terrill Street, Blackwood 3458',
    lat: -37.472815,
    lon: 144.306469,
    lgaName: 'Moorabool',
  },
  {
    externalRef: 'cfr-lavers-hill',
    typeCode: 'CFR',
    name: 'Lavers Hill Community Fire Refuge',
    address: 'Otway CFA Fire Station, 8-14 Lavers Hill-Cobden Road, Lavers Hill 3238',
    lat: -38.678914,
    lon: 143.390545,
    lgaName: 'Colac Otway',
  },
];

export const syncCfr = (db: Db): Promise<boolean> =>
  runSync(db, SOURCE_ID, async () => {
    const counts = upsertFacilities(db, SOURCE_ID, CFR_SITES);
    rebuildNearestStatic(db);
    return counts;
  });
