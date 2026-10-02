import type { Confidence, Placed, Screen } from './blacksky';
import { COMPASS_SILENT_MS, HEADING_FROM_MOVEMENT_MPS } from './constants';
import { PLACES_SEPARATOR } from './copy';

// The rules behind the one-place dial (BS_Enhancement-AC1 and AC2). Everything
// here is a pure function of its arguments: no browser, no clock, no storage.
// deriveState still decides WHAT can be pointed at; this file only decides
// which one of those places is the main subject, and how honestly to draw it.

/** Where the main place comes from, which decides the small label above it.
 *  - 'chosen'  a place the person chose into the loaded pack
 *  - 'nearest' the nearest site on the state-wide list
 *  - 'listed'  a state-wide site the person picked with Show that is NOT the
 *              nearest one, so the word "nearest" would be untrue of it */
export type DialLabel = 'chosen' | 'nearest' | 'listed';

export type DialModel = { first: Placed; label: DialLabel; others: Placed[] };

/**
 * WHICH PLACE IS FIRST.
 *
 * 1. Inside the loaded pack's area, the nearest place the person chose. They
 *    picked it with a clear head, so it beats a state-wide site that happens to
 *    be nearer.
 * 2. Otherwise the nearest site on the state-wide list.
 * 3. A place picked with Show (`chosenId`) overrides both for as long as it can
 *    still be pointed at. An id that has vanished (another pack was loaded, or
 *    the site dropped out of the nearest few) falls back to rules 1 and 2
 *    rather than leaving the screen with no subject.
 *
 * Every other place goes into `others`, nearest first. Null means there is a
 * position but nothing to point at, or no position at all.
 */
export function dialModel(screen: Screen, chosenId: string | null): DialModel | null {
  if (screen.kind === 'ACQUIRING') return null;
  // deriveState returns both lists nearest first, and the screen relies on it.
  const chosen = screen.kind === 'IN_AREA' ? screen.places : [];
  const listed = screen.nearby;
  const all = [...chosen, ...listed];
  if (all.length === 0) return null;

  const first = all.find((place) => place.id === chosenId) ?? all[0];
  const label: DialLabel = chosen.includes(first)
    ? 'chosen'
    : first === listed[0]
      ? 'nearest'
      : 'listed';
  const others = all.filter((place) => place !== first).sort((a, b) => a.distanceM - b.distanceM);
  return { first, label, others };
}

/**
 * The official name split into the part a person looks for and the part that
 * says where it is. The CFA writes every site as
 * "Suburb (Site name) Neighbourhood Safer Place", and the site name may carry
 * brackets of its own, so the split is on the OUTERMOST pair: the first opening
 * bracket and the closing bracket that balances it.
 *
 * The words after the brackets only repeat what the label above the name
 * already says, so they are dropped. A name that does not fit the shape
 * (no brackets, unbalanced brackets, nothing before or inside them) is returned
 * whole: showing the official name as written is always correct.
 */
export function splitSiteName(name: string): { site: string; suburb: string | null } {
  const whole = { site: name.trim(), suburb: null };
  const open = name.indexOf('(');
  if (open < 0) return whole;

  let depth = 0;
  for (let i = open; i < name.length; i += 1) {
    if (name[i] === '(') depth += 1;
    else if (name[i] === ')') depth -= 1;
    if (depth > 0) continue;
    const suburb = name.slice(0, open).trim();
    const site = name.slice(open + 1, i).trim();
    return suburb && site ? { site, suburb } : whole;
  }
  return whole; // the first bracket never closes
}

/**
 * The name block as the dial shows it: the site on one line, where it is on the
 * next. splitSiteName does the first cut. This makes the second: many official
 * site names end in a bracketed qualifier, "Barry Simon Reserve (NE Corner)",
 * and at the dial's size that qualifier wrapped the name onto a second and
 * third line above the one figure the person came for. The qualifier says
 * WHERE at the site, so it belongs with the suburb:
 *   site  "Barry Simon Reserve"
 *   line  "Endeavour Hills · NE Corner"
 * Nothing is dropped; it only moves down a line.
 *
 * Only a qualifier at the very END of the site is moved, found by balancing
 * brackets from the right, so brackets inside the qualifier travel with it. A
 * bracket in the middle of a site name ("Hub (Former Campus) Oval") is part of
 * the name and stays. A name splitSiteName could not split is shown whole, as
 * written, with no second line.
 */
export function siteNameBlock(name: string): { site: string; line: string | null } {
  const { site, suburb } = splitSiteName(name);
  if (suburb === null) return { site, line: null };
  if (!site.endsWith(')')) return { site, line: suburb };

  let depth = 0;
  for (let i = site.length - 1; i >= 0; i -= 1) {
    if (site[i] === ')') depth += 1;
    else if (site[i] === '(') depth -= 1;
    if (depth > 0) continue;
    const lead = site.slice(0, i).trim();
    const qualifier = site.slice(i + 1, -1).trim();
    return lead && qualifier
      ? { site: lead, line: `${suburb}${PLACES_SEPARATOR}${qualifier}` }
      : { site, line: suburb };
  }
  return { site, line: suburb }; // unbalanced: leave the site as written
}

export type HeadingSource =
  | { from: 'movement' | 'compass'; deg: number }
  | { from: 'none'; deg: null };

const isDegrees = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Which reading turns the dial. Moving faster than HEADING_FROM_MOVEMENT_MPS
 * with a direction of movement from GPS, that direction wins: it is measured
 * from where the phone has actually been, so a car body cannot disturb it.
 * Otherwise the compass. With neither, nothing turns the dial and it is drawn
 * north up.
 *
 * Both headings are TRUE north, 0 to 360. Browsers report a heading of NaN for
 * a phone that is not moving, so anything that is not a finite number counts as
 * no reading.
 */
export function headingSource(
  compassDeg: number | null,
  gpsHeadingDeg: number | null | undefined,
  speedMps: number | null | undefined,
): HeadingSource {
  if (isDegrees(gpsHeadingDeg) && isDegrees(speedMps) && speedMps > HEADING_FROM_MOVEMENT_MPS)
    return { from: 'movement', deg: gpsHeadingDeg };
  if (isDegrees(compassDeg)) return { from: 'compass', deg: compassDeg };
  return { from: 'none', deg: null };
}

/** A heading reading and when it arrived. */
export type HeadingReading = { deg: number; at: number };

/** The reading's heading, or null once it is older than COMPASS_SILENT_MS. A
 *  sensor that has gone quiet reports no error, so silence is the only sign;
 *  the caller passes the time in, which keeps this testable at the boundary. */
export const freshHeading = (reading: HeadingReading | null, now: number): number | null =>
  reading && now - reading.at <= COMPASS_SILENT_MS ? reading.deg : null;

/** Where a bearing sits on the screen once the dial has turned with the phone:
 *  0 is the top of the phone, 90 its right-hand side. The stylesheet does this
 *  same subtraction to place the pin; it is written here so the rule can be
 *  tested, wrap at 0/360 included. */
export const relativeBearing = (bearingDeg: number, headingDeg: number): number =>
  (((bearingDeg - headingDeg) % 360) + 360) % 360;

/** How far to trust the position, in the terms the screen draws:
 *  - `bar`   the GPS signal lost bar, and why: the fix is old, or there is no
 *            fix and the position comes from a mark the person made
 *  - `about` the distance is dimmed and prefixed, because the figure is only
 *            as good as an old, vague or estimated position */
export type PositionTrust = { bar: 'stale' | 'mark' | null; about: boolean };

export const positionTrust = (confidence: Confidence, estimating: boolean): PositionTrust => ({
  bar: estimating ? 'mark' : confidence.stale ? 'stale' : null,
  about: estimating || confidence.stale || confidence.approximate,
});

/** How the arrow at the centre of the dial is drawn. The arrow points AT THE
 *  MAIN PLACE, the same way as the pin on the ring, and never at the top of the
 *  phone. With no map inside the dial, an arrow fixed to the top of the phone
 *  told the person nothing, and an arrow is read as "this way": pointing
 *  anywhere but at the place would mislead. When the person turns to face the
 *  place the arrow stands straight up and the pin sits under the notch. With
 *  no heading the dial is north up and the arrow points at the place relative
 *  to north, which is still true; the North up tag says how to read it.
 *
 *  So the only thing left to say here is how far to trust the position the
 *  arrow is drawn from:
 *  - 'arrow'   a fresh position: drawn solid.
 *  - 'outline' an old position, or a mark the person made: drawn hollow. The
 *    bar above already says which ("from your saved place" for a mark). */
export type DialCentre = 'arrow' | 'outline';

export const dialCentre = (trust: PositionTrust): DialCentre =>
  trust.bar === null ? 'arrow' : 'outline';
