import { ADDRESS_QUERY_MIN_CHARS, ADDRESS_RESULT_LIMIT, ROAD_TYPES } from './constants';
import type { AddressCandidate, AddressRecord } from './types';

/** The outcome of turning one address response into things a user may choose.
 * `unresolvedCount` counts exact-address groups the register describes at more
 * than one point without identifying which one it means. Those groups yield no
 * candidate: a coordinate the user cannot see is never guessed at. */
export type AddressCandidateResolution = {

  candidates: AddressCandidate[];
  unresolvedCount: number;

  /** How many records the register actually returned, before any exclusion or
   * collapsing. 
   * Rendered next to the number of lines so a capped response reads
   * as a cap and not as the whole register. */
  returnedCount: number;
};

/** What the register said about ONE query.
 * The query it answers is carried with it, 
 * which is what makes a stale answer structurally unusable rather than 
 * merely unlikely: nothing can render it once the field says something else. */
export type SettledSearch = {
  query: string;
  outcome:
    | { kind: 'resolved', resolution: AddressCandidateResolution }
    | { kind: 'failed' };
};

/** The six states of the search field.
 * Three of them are routinely conflated by 
 * live-search implementations and are separated here by construction:
 *   'pending'      — the query has no answer of its own yet, whether the debounce
 *                    is still running or the request is in flight. No result
 *                    claim of any kind is reachable from this state.
 *
 *   'no-match'     — the register answered, about this exact query, with nothing.
 *
 *   'unavailable'  — the search could not be run. Never 'no-match'.
 **/
type AddressSearchState =
  | { kind: 'too-short' }
  | { kind: 'pending' }
  | {
      kind: 'candidates';
      candidates: AddressCandidate[];
      unresolvedCount: number;
      returnedCount: number;
    }
  | { kind: 'no-match' }
  | { kind: 'unavailable' }
  | { kind: 'dismissed' };

export function addressQueryCanRun(query: string): boolean {
  return query.trim().length >= ADDRESS_QUERY_MIN_CHARS;
}

/** True when the response is the size of the cap, so the register may hold more than it was asked for. 
 * Inclusive at the limit: a response of exactly
 * ADDRESS_RESULT_LIMIT records cannot be shown the whole answer. */
export function addressResultsAtLimit(returnedCount: number): boolean {
  return returnedCount >= ADDRESS_RESULT_LIMIT;
}

/** Two typed strings are the same search. Surrounding whitespace is not part of
 * the query the register was asked, so it must not make an answer look stale. */
export function sameAddressQuery(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/** A CQL string literal. Typed apostrophes are removed before this is reached,
 * so nothing inside the text can end the literal. */
const quoted = (text: string): string => `'${text}'`;

const UNIT_WORDS = '(?:UNIT|FLAT|APT|SHOP|U)';
const UNIT_ID = '([A-Z]{0,2}\\d{1,5}[A-Z]?)';
// "7/", "G04/", "UNIT 7/" or "UNIT 7 " ahead of the house number.
const UNIT_PATTERN = new RegExp(
  `^(?:${UNIT_WORDS}\\s*)?${UNIT_ID}\\s*/\\s*|^${UNIT_WORDS}\\s*${UNIT_ID}\\s+(?=\\d)`,
);
// "1774", "1774A" or the first number of a typed range such as "1774-1776".
// Six digits is past any real house number and keeps the number a plain integer.
const NUMBER_PATTERN = /^(\d{1,6})([A-Z])?(?:\s*-\s*\d+[A-Z]?)?(?:\s+|$)/;

/** Turn typed text into the register's own fields, so an address matches however
 * it was typed: a number inside a stored range ("1774" finds "1774-1776"), a
 * unit, short road types ("Rd"), commas, "VIC", a postcode, or no suburb at all.
 *
 * The register spells O'Connor as OCONNOR, so apostrophes are removed. After
 * that only letters, digits, spaces and / - survive, which drops the LIKE
 * wildcards and everything else CQL could read as syntax. Every word is sent as
 * a quoted literal and every number as a number. The typed text in the field is
 * never changed. */
export function addressFilterForCql(query: string): string {
  const text = query
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/[^A-Z0-9 /-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const clauses: string[] = [];

  const unit = UNIT_PATTERN.exec(text);
  const afterUnit = unit ? text.slice(unit[0].length) : text;
  const number = NUMBER_PATTERN.exec(afterUnit);
  const words = (number ? afterUnit.slice(number[0].length) : afterUnit)
    .split(' ')
    .filter((word) => word !== '')
    .map((word) => (word === 'MT' ? 'MOUNT' : word)) // the register spells it out
    .slice(0, 8); // bounds the number of splits a long paste can produce

  // The tail may read "VIC 3168" or "3168 VIC", so the state is dropped on both
  // sides of the postcode.
  const dropState = () => {
    while (['AUSTRALIA', 'VICTORIA', 'VIC'].includes(words.at(-1) ?? '')) words.pop();
  };
  dropState();
  const postcode = /^\d{4}$/.test(words.at(-1) ?? '') ? words.pop() : undefined;
  dropState();

  // No road was typed, so there are no fields to ask about: the text is matched
  // against the start of the full address, as a bare "1774" always was.
  if (words.length === 0) return `ezi_address LIKE ${quoted(`${text}%`)}`;

  // The register holds units in several fields, but always writes them first
  // in the full address, as "7/" or "G04/".
  if (unit) clauses.push(`ezi_address LIKE ${quoted(`${unit[1] ?? unit[2]}/%`)}`);
  if (number) {
    const n = Number(number[1]);
    clauses.push(`house_number_1 <= ${n} AND (house_number_1 = ${n} OR house_number_2 >= ${n})`);
    if (number[2]) clauses.push(`house_suffix_1 = ${quoted(number[2])}`);
  }
  if (postcode) clauses.push(`postcode = ${quoted(postcode)}`);

  // Where the road name ends and the suburb begins is not knowable from the
  // text, so every split is offered and the register keeps the ones that exist.
  const suburb = (rest: string[]) =>
    rest.length > 0 ? ` AND locality_name LIKE ${quoted(`${rest.join(' ')}%`)}` : '';
  const splits: string[] = [];
  for (let i = 1; i <= words.length; i += 1) {
    const road = words.slice(0, i).join(' ');
    const rest = words.slice(i);
    splits.push(`(road_name LIKE ${quoted(`${road}%`)}${suburb(rest)})`);
    const roadType = ROAD_TYPES[rest[0] ?? ''];
    if (roadType) {
      splits.push(
        `(road_name = ${quoted(road)} AND road_type = ${quoted(roadType)}${suburb(rest.slice(1))})`,
      );
    }
  }
  clauses.push(`(${splits.join(' OR ')})`);

  return clauses.join(' AND ');
}

function pointKey({ lat, lon }: AddressCandidate): string {
  return `${lat} ${lon}`;
}

/** Resolve one exact-address group to the single record it stands for, or to
 * null when the register does not say which record that is. */
function resolveGroup(group: readonly AddressRecord[]): AddressCandidate | null {
  const flagged = group.filter(({ isPrimary }) => isPrimary);
  const onePoint = group.every(
    (record) => pointKey(record.candidate) === pointKey(group[0].candidate),
  );

  // One point: the records differ only in fields the user never sees and never
  // chose between, so collapsing loses nothing. The selection flag breaks the
  // tie in place, without it the service's own first record stands. Neither
  // moves a candidate or marks it.
  if (onePoint)  return (flagged[0] ?? group[0]).candidate;

  // Different points: exactly one flagged record is the only evidence of which
  // location the register means. With none, or with several, any pick would be
  // a fabricated coordinate behind an identical-looking button, so the group is
  // withheld and counted instead.
  return flagged.length === 1 ? flagged[0].candidate : null;
}

/** Exclude inactive records, then resolve each exact `ezi_address` to at most
 * one candidate at its first-seen position. The grouping key is the returned
 * address string verbatim — no trimming, case folding or punctuation stripping
 * — so two officially distinct addresses, including units, suffixes and street
 * numbers, can never merge. Nothing is reordered, ranked or scored. */
export function resolveAddressCandidates(
  records: readonly AddressRecord[],
): AddressCandidateResolution {
  const groups = new Map<string, AddressRecord[]>();

  for (const record of records) {
    if (record.propertyStatus !== 'A') continue;
    const group = groups.get(record.candidate.address);
    if (group) group.push(record);
    else groups.set(record.candidate.address, [record]);
  }

  const candidates: AddressCandidate[] = [];
  let unresolvedCount = 0;

  // Map iteration is insertion-ordered, so this is the service's own order.
  for (const group of groups.values()) {
    const candidate = resolveGroup(group);
    if (candidate) candidates.push(candidate);
    else unresolvedCount += 1;
  }

  return { candidates, unresolvedCount, returnedCount: records.length };
}

export function completedSearchState(
  resolution: AddressCandidateResolution,
): AddressSearchState {
  // A response holding something the register could not pin down is not the
  // same as a response holding nothing.
  return resolution.candidates.length === 0 && resolution.unresolvedCount === 0
    ? { kind: 'no-match' }
    : {
        kind: 'candidates',
        candidates: [...resolution.candidates],
        unresolvedCount: resolution.unresolvedCount,
        returnedCount: resolution.returnedCount,
      };
}

/** The one place the live search decides what the screen may say.
 *
 * A result claim — a list, a count, or the no-match sentence — is reachable only
 * through a settled answer whose own query still matches the field. A query the
 * user is still typing, a request in flight, and an answer to something they
 * typed earlier all land in 'pending', which claims nothing. `dismissed` is the
 * user having said none of the listed addresses is theirs, it lasts until the
 * query changes, and it withholds the list without asserting a result either. */
export function liveSearchState(
  query: string,
  settled: SettledSearch | null,
  dismissed: boolean,
): AddressSearchState {
  if (!addressQueryCanRun(query)) return { kind: 'too-short' };
  if (!settled || !sameAddressQuery(settled.query, query)) return { kind: 'pending' };
  if (dismissed) return { kind: 'dismissed' };
  return settled.outcome.kind === 'failed'
    ? { kind: 'unavailable' }
    : completedSearchState(settled.outcome.resolution);
}
