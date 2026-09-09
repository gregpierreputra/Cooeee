import type { DynamicType, FacilityType, StaticType } from './types';

// The two families of facility type (spec §1) and which upstream source answers
// for each (spec §2). A leaf module with no runtime imports, so the API server
// loads it directly under Node and the client under Vite — one map, not two.
export const BUSHFIRE_TYPES: readonly StaticType[] = ['NSP', 'CFR'];
export const HEAT_TYPES: readonly StaticType[] = ['COOL'];
export const STATIC_TYPES: readonly StaticType[] = [...BUSHFIRE_TYPES, ...HEAT_TYPES];
export const DYNAMIC_TYPES: readonly DynamicType[] = ['ERC', 'RELIEF', 'RECOVERY', 'ASSEMBLY'];

export const FACILITY_SOURCE: Record<FacilityType, string> = {
  NSP: 'cfa_nsp_arcgis',
  CFR: 'cfr_static_list',
  COOL: 'vicmap_foi_cool',
  ERC: 'vicemergency_feed',
  RELIEF: 'vicemergency_feed',
  RECOVERY: 'vicemergency_feed',
  ASSEMBLY: 'vicemergency_feed',
};

/** How each upstream is named on screen and in the API's sentences. */
export const SOURCE_NAMES: Record<string, string> = {
  cfa_nsp_arcgis: 'Country Fire Authority Neighbourhood Safer Places list',
  cfr_static_list: 'Community Fire Refuge list',
  vicmap_foi_cool: 'Vicmap Features of Interest',
  vicmap_admin_postcodes: 'Vicmap postcode list',
  vicemergency_feed: 'VicEmergency feed',
};
