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
