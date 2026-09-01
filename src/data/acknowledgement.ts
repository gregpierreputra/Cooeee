import type { FlagStore } from '../core/acknowledgement';

/** The one place the acknowledgement flag's storage is reached. Reading
 *  `window.localStorage` is itself a throwing operation where site data is
 *  blocked, so the access sits here, behind a null, and the decision in
 *  src/core stays pure. A null store reads as "not acknowledged". */
export function localFlagStore(): FlagStore | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
