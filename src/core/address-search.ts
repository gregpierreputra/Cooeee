import {
  ADDRESS_FILTER_MAX_CHARS,
  ADDRESS_QUERY_MAX_CHARS,
  ADDRESS_QUERY_MIN_CHARS,
  ADDRESS_RESULT_LIMIT,
  ADDRESS_WORD_MAX_CHARS,
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
const quoted = (text: string): string => `'${text.replace(/%+/g, '%')}'`;

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
function roadClauses(words: readonly string[], loose = false): string[] {
  // A loose reading keeps only the first three letters of the first word, so a
  // slip later in a name ("Dandinong", "Claton") still finds it.
  const opening = (word: string) => (loose && word.length > 3 ? `${word.slice(0, 3)}%` : word);
  // A wildcard straight after a one or two character word ("K Road", "Mt
  // Dandenong", "St Kilda") would leave the register that little to search by,
  // which takes seconds when nothing matches, so that one gap stays a plain
  // space. The hyphen such a word may carry ("TI-TREE", "A-FRAME") is asked
  // for as a reading of its own, in roadReadings.
  const joined = (part: readonly string[]) =>
    part[0].length <= 2 && part.length > 1
      ? `${part[0]} ${part.slice(1).join('_')}`
      : [opening(part[0]), ...part.slice(1)].join('_');
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

/** Every reading of the words as a road, with the two a very short first word
 * adds: joined to the next word by a hyphen ("A-FRAME TRACK", "TI-TREE DRIVE",
 * "C5-1 TRACK"), and for a lone letter, written as one word ("A'Beckett" is
 * ABECKETT in the register). */
function roadReadings(words: readonly string[], loose: boolean): string[] {
  const readings = roadClauses(words, loose);
  if (words.length > 1 && words[0].length <= 2) {
    readings.push(...roadClauses([`${words[0]}-${words[1]}`, ...words.slice(2)], loose));
    if (words[0].length === 1) readings.push(...roadClauses([words[0] + words[1], ...words.slice(2)], loose));
  }
  return readings;
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

/** People also write the suburb first ("Clayton, 1774 Dandenong Road") or the
 * number after the road ("Dandenong Road 1774 Clayton"). Which of the two it is
 * cannot be told from the words ("Burnside Heights" is a suburb, "Riverside
 * Quay" is a road), so both are offered. They never replace the text as typed,
 * which is asked first: "Yendon No 2 Road" has a number and is in order. Each
 * is in the order the rest of this file reads: number, road, suburb. */
function reorderings(text: string): string[] {
  const tokens = text.split(' ');
  const unitWord = /^(?:UNIT|FLAT|APT|APARTMENT|SHOP|SUITE)$/;
  const looksLikeNumber = (token: string) =>
    /^(?:[A-Z0-9-]{1,10}\/)?[A-Z]{0,2}\d{1,6}(?:[A-Z][A-Z0-9]?)?(?:-[A-Z0-9]{1,7})?$/.test(token);
  // Text that opens with a number or a unit is already in order.
  // A unit word counts only with its unit after it: "Flat 2 ..." is in order,
  // "Flat Rock Road 115" is a road with its number after it.
  const opensWithUnit = unitWord.test(tokens[0]) && /\d/.test(tokens[1] ?? '');
  if (looksLikeNumber(tokens[0]) || opensWithUnit || tokens[1] === '/') return [];

  const looksLikePostcode = (token: string) => /^[38]\d{3}$/.test(token);
  // A postcode shaped number at the very end is the postcode. Anywhere else it
  // may be a house number ("3460 Great Ocean Road"), and is taken as one only
  // when no other number was typed.
  const numbers = tokens
    .map((token, index) => (looksLikeNumber(token) ? index : -1))
    .filter((index) => index > 0 && !(index === tokens.length - 1 && looksLikePostcode(tokens[index])));
  // Of two postcode shaped numbers ("Glenaire 3238, 3460 Great Ocean Road") the
  // house number is the one with a word after it.
  const at = numbers.find((index) => !looksLikePostcode(tokens[index]))
    ?? numbers.find((index) => !looksLikeNumber(tokens[index + 1] ?? ''))
    ?? numbers[0];
  if (at === undefined) return [];

  // "... Unit 7/1774 ..." leaves its unit word behind, which the slash already
  // says. Only the word right before the number: "Grassy Flat Road" keeps its Flat.
  const before = tokens.slice(0, at);
  if (unitWord.test(before.at(-1) ?? '')) before.pop();
  const after = tokens.slice(at + 1);
  return [
    [tokens[at], ...after, ...before].join(' '), // the suburb was first
    [tokens[at], ...before, ...after].join(' '), // the road was first
  ];
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
 * as a number. The typed text in the field is never changed.
 *
 * `loose` is the second try, made only when the first finds nothing: it forgives
 * a slip after the third letter of the road or suburb, and reads the suburb
 * ahead of the road. */
export function addressFilterForCql(query: string, loose = false): string {
  return boundedFilter([cleanedText(query)], loose);
}

/** The same question with the words put back in order, for text that opens
 * with the suburb or the road and has its number later. Null when the text is
 * already in order. It is asked on its own, after the text as typed found
 * nothing: asked together, the register takes seconds to answer. */
export function reorderedFilterForCql(query: string, loose = false): string | null {
  const orders = reorderings(cleanedText(query));
  return orders.length > 0 ? boundedFilter(orders, loose) : null;
}

function cleanedText(query: string): string {
  return query
    // No address is this long. A longer paste is cut before anything reads it,
    // so no pattern below can be made slow and no filter can be made huge.
    .slice(0, ADDRESS_QUERY_MAX_CHARS)
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Z0-9 /-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // The register keeps no floor and no lot, so "Level 8, 15 Queens Road" is
    // read as the building and "Lot 5 Smith Road" as the road. Only with a
    // number after it: "Lot Street" and "Level Crossing Road" are roads.
    .replace(/^(?:LEVEL|LVL|FLOOR|LOT)\s*[A-Z]?\d+[A-Z]?\s+/, '');
}

/** The register refuses a request much past 8,000 characters, so a long address
 * is read by fewer of its words, which only widens the match. Short words are
 * what make a filter long (each adds readings), so the limit goes all the way
 * down to one word, where every filter fits. */
function boundedFilter(texts: readonly string[], loose: boolean): string {
  for (let wordLimit = 8; ; wordLimit -= 1) {
    const filters = [...new Set(texts.map((text) => filterForText(text, loose, wordLimit)))];
    const filter = filters.length === 1 ? filters[0] : `((${filters.join(') OR (')}))`;
    if (filter.length <= ADDRESS_FILTER_MAX_CHARS || wordLimit === 1) return filter;
  }
}

/** The filter for text already in order: unit, number, road, suburb, postcode. */
function filterForText(text: string, loose: boolean, wordLimit: number): string {
  const clauses: string[] = [];

  const unit = UNIT_PATTERN.exec(text);
  const afterUnit = unit ? text.slice(unit[0].length) : text;
  const number = NUMBER_PATTERN.exec(afterUnit);
  const words = (number ? afterUnit.slice(number[0].length) : afterUnit)
    .split(/[ /-]/)
    .filter((word) => word !== '')
    .map((word) => word.slice(0, ADDRESS_WORD_MAX_CHARS)); // no road or suburb word is longer

  // The tail may read "VIC 3168" or "3168 VIC", so the state is dropped on both
  // sides of the postcode.
  const dropState = () => {
    // The last word left is the road itself, as in "42 Victoria".
    while (words.length > 1 && ['AUSTRALIA', 'VICTORIA', 'VIC'].includes(words.at(-1) ?? '')) words.pop();
  };
  dropState();
  const postcode = /^\d{4}$/.test(words.at(-1) ?? '') ? words.pop() : undefined;
  dropState();
  // Only now are the words cut to the limit, which bounds the number of
  // readings a long paste can produce. The postcode was taken first, so a long
  // address keeps the one part that narrows the search most.
  words.length = Math.min(words.length, wordLimit);

  // No road was typed, so there are no fields to ask about: the text is matched
  // against the start of the full address, as a bare "1774" always was.
  if (words.length === 0) return `ezi_address LIKE ${quoted(`${text.slice(0, ADDRESS_WORD_MAX_CHARS)}%`)}`;

  // The register holds units in several fields, but always writes them first
  // in the full address, as "7/" or "G04/".
  // A few units carry the U themselves ("U6/6-14"), so both are asked for.
  if (unit) {
    const id = unit[1] ?? unit[2];
    clauses.push(`(ezi_address LIKE ${quoted(`${id}/%`)} OR ezi_address LIKE ${quoted(`U${id}/%`)})`);
  }
  if (postcode) clauses.push(`postcode = ${quoted(postcode)}`);

  const readings = mountSpellings(words).flatMap((spelling) => roadReadings(spelling, loose));
  if (loose) {
    // The suburb may come first ("Clayton Dandenong Road"), so each way of
    // moving the leading words to the end is read as well.
    for (let i = 1; i < words.length; i += 1) {
      readings.push(...roadReadings([...words.slice(i), ...words.slice(0, i)], true));
    }
  }
  // A short code where the number would be, with no number ("A MARIBYRNONG
  // STREET", "LB JARLO DRIVE", "HHS2 ARTS DRIVE"): the road is also read without it.
  if (!number && words.length > 1 && words[0].length <= 4) readings.push(...roadReadings(words.slice(1), loose));
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
  const numberedRoad = roadReadings([...typedNumber.trim().split(/[ -]+/), ...words], loose).join(' OR ');
  // Letters ahead of the number are a building code the register may hold some
  // other way ("LM1 JARLO DRIVE"), so the road alone is offered too.
  const alone = prefix ? ` OR ${roads}` : '';
  return [...clauses, `((${house}) OR ${numberedRoad}${alone})`].join(' AND ');
}

/** A place known by its name and not its address ("Monash University", "Royal
 * Melbourne Hospital"), as the register's building and site names hold it. The
 * register has no index on those names, so this takes seconds. It is asked
 * last, and only when no number was typed. Null when there is nothing to ask. */
export function placeNameFilterForCql(query: string): string | null {
  const words = query
    .slice(0, ADDRESS_QUERY_MAX_CHARS)
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/[^A-Z ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.slice(0, ADDRESS_WORD_MAX_CHARS));
  if (/\d/.test(query) || words.join('').length < ADDRESS_QUERY_MIN_CHARS) return null;
  const name = quoted(`${words.slice(0, 8).join('_')}%`);
  return `(building_name LIKE ${name} OR complex_name LIKE ${name})`;
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
