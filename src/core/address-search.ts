import {
  ADDRESS_QUERY_MIN_CHARS,
  ADDRESS_RESULT_LIMIT,
  ROAD_DIRECTIONS,
  ROAD_TYPES,
} from './constants';
import type { AddressCandidate, AddressRecord } from './types';

/** The outcome of turning one address response into things a user may choose. */
export type AddressCandidateResolution = {
  candidates: AddressCandidate[];

  /** How many records the register actually returned, before any exclusion or
   * collapsing. Rendered next to the number of lines so a capped response reads
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

/** A CQL string literal. Only letters, digits and the two LIKE wildcards this
 * file writes itself ever reach one, so nothing inside can end the literal. */
const quoted = (text: string): string => `'${text}'`;

// A unit word stands alone ("Unity Lane" is a road), and a bare U counts only
// hard against its number ("U7").
const UNIT_WORDS = '(?:(?:UNIT|FLAT|APT|APARTMENT|SHOP|SUITE)(?![A-Z])|U(?=\\d))';
// A unit as the register writes it before the slash: 7, G04, A, 10-11, 2-3A,
// and once in a while with a slash of its own ("1122/3/1239 NEPEAN HIGHWAY").
const UNIT_ID = '([A-Z0-9][A-Z0-9-]{0,13}(?:/[A-Z0-9]{1,4}(?=\\s*/))?)';
// Typed after a unit word it must hold a digit ("7", "G04"), be one letter or
// a letter range ("F", "B-E"), or be a few letters ahead of a house number
// ("GD 622"), so that "Flat Rock Road" stays a road.
const WORDED_UNIT_ID =
  '((?=[A-Z-]*\\d)[A-Z0-9][A-Z0-9-]{0,9}|[A-Z](?:-[A-Z])?(?![A-Z0-9])|[A-Z-]{2,3}(?=\\s+[A-Z]?\\d))';
// "7/", "G04/" or "UNIT 7/" by the slash, or "UNIT 7 " by the word. Some units
// have no house number after them ("3/ PRINCES WALK").
const UNIT_PATTERN = new RegExp(
  `^(?:${UNIT_WORDS}\\s*)?${UNIT_ID}\\s*/\\s*|^${UNIT_WORDS}\\s*${WORDED_UNIT_ID}\\s+`,
);
// "1774", "1774A", "R25", "FF10A", "2AA" or the first number of a typed range
// such as "1774-1776" or "85B-C". Six digits is past any real house number and
// keeps it an integer.
const NUMBER_PATTERN = /^([A-Z]{1,2})?(\d{1,6})([A-Z][A-Z0-9]?)?(?:\s*-\s*[A-Z0-9]{1,7})?(?:\s+|$)/;

/** One CQL clause per way the words could be a road, its type, its direction
 * and its suburb. Where one ends and the next begins is not knowable from the
 * text, so every reading is offered and the register keeps the ones that exist.
 *
 * Words are joined with the LIKE single-character wildcard, so a road typed as
 * "Barmah Shepparton" also finds the register's "BARMAH-SHEPPARTON". */
function roadClauses(words: readonly string[]): string[] {
  // A wildcard straight after a one character word ("K Road", "1 St Kilda")
  // would leave the register one character to search by, which takes seconds,
  // so that one gap stays a plain space. Two characters must keep the wildcard:
  // "TI-TREE", "HI-TECH" and "CO-OP" are real roads.
  const joined = (part: readonly string[]) =>
    part[0].length === 1 && part.length > 1
      ? `${part[0]} ${part.slice(1).join('_')}`
      : part.join('_');
  const suburb = (rest: readonly string[]) =>
    rest.length > 0 ? ` AND locality_name LIKE ${quoted(`${joined(rest)}%`)}` : '';
  const clauses: string[] = [];

  for (let i = 1; i <= words.length; i += 1) {
    const road = joined(words.slice(0, i));
    const [next, after, ...rest] = words.slice(i);
    // The words so far begin the road name, and the rest begin the suburb. One
    // letter alone is too little to begin a road by, so it must be the whole
    // name ("K Road").
    clauses.push(`(road_name LIKE ${quoted(road.length > 1 ? `${road}%` : road)}${suburb(words.slice(i))})`);
    if (next === undefined) continue;

    // The next word is the road type, short, in full or still being typed:
    // "Rd", "Road", "Vista", "Stre".
    // A short form is also kept as typed: "Cir" begins Circus as well as Circuit.
    const full = ROAD_TYPES[next];
    const typeIs = full
      ? `(road_type = ${quoted(full)} OR road_type LIKE ${quoted(`${next}%`)})`
      : `road_type LIKE ${quoted(`${next}%`)}`;
    const type = `road_name LIKE ${quoted(road)} AND ${typeIs}`;
    clauses.push(`(${type}${suburb(words.slice(i + 1))})`);
    // A direction after the type: "Market Street S", "Barkly Terrace East". A
    // single letter may be one still being typed ("E" on the way to "Ex").
    const ending = (word: string | undefined) =>
      word === undefined ? undefined : (ROAD_DIRECTIONS[word] ?? (word.length === 1 ? word : undefined));
    if (ending(after)) {
      clauses.push(`(${type} AND road_suffix LIKE ${quoted(`${ending(after)}%`)}${suburb(rest)})`);
    }
    // A direction straight after a road with no type: "The Esplanade S".
    if (ending(next)) {
      clauses.push(
        `(road_name LIKE ${quoted(road)} AND road_suffix LIKE ${quoted(`${ending(next)}%`)}${suburb(words.slice(i + 1))})`,
      );
    }
  }
  return clauses;
}

/** The register writes "MT PLEASANT" for some roads and "MOUNT DANDENONG" for
 * others, and a road and its suburb may differ, so each typed Mt or Mount is
 * asked for both ways. A plain prefix keeps the search fast, which a wildcard
 * inside the word would not. Two such words cover every real address. */
function mountSpellings(words: readonly string[]): string[][] {
  let spellings: string[][] = [[]];
  let swaps = 0;
  for (const word of words) {
    const isMount = (word === 'MT' || word === 'MOUNT') && swaps < 2;
    if (isMount) swaps += 1;
    const forms = isMount ? ['MT', 'MOUNT'] : [word];
    spellings = spellings.flatMap((sofar) => forms.map((form) => [...sofar, form]));
  }
  return spellings;
}

/** Turn typed text into the register's own fields, so an address matches however
 * it was typed: a number inside a stored range ("1774" finds "1774-1776"), a
 * unit, short road types ("Rd"), a direction ("Street South"), commas, "VIC",
 * a postcode, or no suburb at all.
 *
 * The register spells O'Connor as OCONNOR, so apostrophes are removed, and a
 * bracketed part such as "Newtown (Geelong)" is dropped. After that only
 * letters, digits, spaces and / - survive, which drops everything CQL could
 * read as syntax. Every word is sent inside a quoted literal and every number
 * as a number. The typed text in the field is never changed. */
export function addressFilterForCql(query: string): string {
  const text = query
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Z0-9 /-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // The register keeps no floor, so "Level 8, 15 Queens Road" is read as the building.
    .replace(/^(?:LEVEL|LVL|FLOOR)\s*[A-Z0-9]+\s+/, '');
  const clauses: string[] = [];

  const unit = UNIT_PATTERN.exec(text);
  const afterUnit = unit ? text.slice(unit[0].length) : text;
  const number = NUMBER_PATTERN.exec(afterUnit);
  const words = (number ? afterUnit.slice(number[0].length) : afterUnit)
    .split(/[ /-]/)
    .filter((word) => word !== '')
    .slice(0, 8); // bounds the number of readings a long paste can produce

  // The tail may read "VIC 3168" or "3168 VIC", so the state is dropped on both
  // sides of the postcode.
  const dropState = () => {
    // The last word left is the road itself, as in "42 Victoria".
    while (words.length > 1 && ['AUSTRALIA', 'VICTORIA', 'VIC'].includes(words.at(-1) ?? '')) words.pop();
  };
  dropState();
  const postcode = /^\d{4}$/.test(words.at(-1) ?? '') ? words.pop() : undefined;
  dropState();

  // No road was typed, so there are no fields to ask about: the text is matched
  // against the start of the full address, as a bare "1774" always was.
  if (words.length === 0) return `ezi_address LIKE ${quoted(`${text.replace(/[^A-Z0-9 /-]/g, '')}%`)}`;

  // The register holds units in several fields, but always writes them first
  // in the full address, as "7/" or "G04/".
  // A few units carry the U themselves ("U6/6-14"), so both are asked for.
  if (unit) {
    const id = unit[1] ?? unit[2];
    clauses.push(`(ezi_address LIKE ${quoted(`${id}/%`)} OR ezi_address LIKE ${quoted(`U${id}/%`)})`);
  }
  if (postcode) clauses.push(`postcode = ${quoted(postcode)}`);

  const readings = mountSpellings(words).flatMap(roadClauses);
  if (words.length > 1 && words[0].length === 1) {
    // A lone first letter may belong to a name the register writes as one word
    // ("A'Beckett" is ABECKETT) or with a hyphen ("A-FRAME TRACK").
    readings.push(...roadClauses([words[0] + words[1], ...words.slice(2)]));
    readings.push(...roadClauses([`${words[0]}-${words[1]}`, ...words.slice(2)]));
  }
  // A short code where the number would be, with no number ("A MARIBYRNONG
  // STREET", "LB JARLO DRIVE", "HHS2 ARTS DRIVE"): the road is also read without it.
  if (!number && words.length > 1 && words[0].length <= 4) readings.push(...roadClauses(words.slice(1)));
  const roads = `(${readings.join(' OR ')})`;
  if (!number) return [...clauses, roads].join(' AND ');

  const [typedNumber, prefix, digits, suffix] = number;
  const n = Number(digits);
  const house = [
    `house_number_1 <= ${n} AND (house_number_1 = ${n} OR house_number_2 >= ${n})`,
    ...(prefix ? [`house_prefix_1 = ${quoted(prefix)}`] : []),
    ...(suffix ? [`house_suffix_1 = ${quoted(suffix)}`] : []),
    roads,
  ].join(' AND ');
  // A few roads are named like a house number ("15 MILE ROAD", "Z2 ROAD",
  // "C23-2 TRACK"), so the number is also read as the start of the road.
  const numberedRoad = roadClauses([...typedNumber.trim().split(/[ -]+/), ...words]).join(' OR ');
  // Letters ahead of the number are a building code the register may hold some
  // other way ("LM1 JARLO DRIVE"), so the road alone is offered too.
  const alone = prefix ? ` OR ${roads}` : '';
  return [...clauses, `((${house}) OR ${numberedRoad}${alone})`].join(' AND ');
}

/** Exclude inactive records, then resolve each exact `ezi_address` to one
 * candidate at its first-seen position. The grouping key is the returned
 * address string verbatim, with no trimming, case folding or punctuation
 * stripping, so two officially distinct addresses, including units, suffixes
 * and street numbers, can never merge. Nothing is reordered, ranked or scored.
 *
 * The register lists about one address in 230 at more than one point, a few
 * tens of metres apart, without marking one of them. Such an address is still
 * a real home, so it is offered at the register's own flagged record, or its
 * first record when none is flagged. */
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

  // Map iteration is insertion-ordered, so this is the service's own order.
  const candidates = [...groups.values()].map(
    (group) => (group.find(({ isPrimary }) => isPrimary) ?? group[0]).candidate,
  );
  return { candidates, returnedCount: records.length };
}

export function completedSearchState(
  resolution: AddressCandidateResolution,
): AddressSearchState {
  return resolution.candidates.length === 0
    ? { kind: 'no-match' }
    : {
        kind: 'candidates',
        candidates: [...resolution.candidates],
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
