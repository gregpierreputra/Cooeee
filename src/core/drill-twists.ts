// The drill's twists: one rule that changes the drill for three days, then
// gives way to the next. Forty of them, so a twist comes round again only
// after four months, and in a different order each time round.
//
// A twist changes only what the classic drill already has: the size of the
// bag, the time, the pace, the light, what a thing is worth, a doorway that
// is shut, where things are, or a few more things in the house. Every score
// is still out of 100: 100 is the best bag this twist allows, so a small bag
// filled well scores as high as a big one.
//
// The ids are stored with every drill on the phone. Never rename or remove
// one; add new twists at the end.

import { cyclePick } from './seeded';
import { daysLeftInPeriod } from './day';
import { reachableCells, withinReach, type Closed } from './drill-house';
import { BAG_LIMIT, DRILL_ITEMS, DRILL_SECONDS, EXTRA_ITEMS, type DrillItem, type DrillRoom } from './drill-items';

/** The light in the house: the dark and smoke as they start and how much
 *  they grow over the drill, the pool of sight round the person without and
 *  with the torch (inner and outer, in pixels), and whether the power is on. */
export type Light = {
  dark: readonly [start: number, growth: number];
  smoke: readonly [start: number, growth: number];
  sight: readonly [inner: number, outer: number];
  torch: readonly [inner: number, outer: number];
  powered: boolean;
};

const LIGHTS = {
  classic: { dark: [0.62, 0.12], smoke: [0.08, 0.22], sight: [16, 58], torch: [34, 100], powered: false },
  night: { dark: [0.78, 0.12], smoke: [0.08, 0.22], sight: [12, 42], torch: [40, 112], powered: false },
  smoke: { dark: [0.62, 0.12], smoke: [0.2, 0.35], sight: [14, 50], torch: [30, 90], powered: false },
  'lights-on': { dark: [0.22, 0.08], smoke: [0.08, 0.22], sight: [16, 58], torch: [34, 100], powered: true },
} satisfies Record<string, Light>;

/** The doorways a twist can shut, as the cells shut, from drill-layout.ts. */
const LOCKS = {
  study: [[16, 14], [17, 14]],
  bathroom: [[10, 14], [11, 14]],
  'main bedroom': [[5, 14], [6, 14]],
  'second bedroom': [[23, 14], [24, 14]],
  garage: [[3, 11], [4, 11], [6, 6], [6, 7]],
  laundry: [[8, 11], [9, 11], [6, 6], [6, 7]],
} satisfies Record<string, [number, number][]>;
type LockId = keyof typeof LOCKS;

type Move = { room: DrillRoom; x: number; y: number };

/** One twist as written: only what it changes. */
type TwistSpec = {
  id: string;
  name: string;
  /** One or two plain sentences: what is different, and why it matters. */
  rule: string;
  bag?: number;
  seconds?: number;
  pace?: number;
  bulkyCost?: number;
  light?: keyof typeof LIGHTS;
  weights?: Record<string, number>;
  remove?: string[];
  move?: Record<string, Move>;
  add?: string[];
  lock?: LockId[];
};

/** Everything the drill reads, with the twist applied. */
export type DrillRules = {
  twist: string;
  name: string;
  rule: string;
  bagLimit: number;
  seconds: number;
  /** Walking pace, as a share of the classic pace. */
  pace: number;
  /** How much of the pace each bulky thing carried costs. */
  bulkyCost: number;
  light: Light;
  /** Every thing in the house, with this twist's weights and places. */
  items: DrillItem[];
  /** The things a person can get within reach of. */
  reachable: DrillItem[];
  /** The shut doorway cells, as "x,y" keys, and where to draw the boards. */
  closed: Closed;
  barriers: { x: number; y: number }[];
  /** The points in the best bag this twist allows: what 100 stands for. */
  maxPoints: number;
};

export const TWISTS: readonly TwistSpec[] = [
  { id: 'small-bag', name: 'Small bag', rule: 'Only seven things fit in the bag. Pack the ones you cannot do without.', bag: 7 },
  { id: 'day-pack', name: 'Day pack', rule: 'Only five things fit. Choose carefully, the essentials first.', bag: 5 },
  { id: 'room-in-the-boot', name: 'Room in the boot', rule: 'Twelve things fit this time. There is room for every essential and more.', bag: 12 },
  { id: 'eight-in-a-hurry', name: 'Eight in a hurry', rule: 'Eight things fit, and there is less time to find them.', bag: 8, seconds: 100 },
  { id: 'two-bags', name: 'Two bags', rule: 'Two bags hold twelve things, but carrying both slows you down.', bag: 12, pace: 0.85 },
  { id: 'six-by-torchlight', name: 'Six by torchlight', rule: 'It is dark, and only six things fit. Find the torch first.', bag: 6, light: 'night' },
  { id: 'ninety-seconds', name: 'Ninety seconds', rule: 'The fire is closer than you thought. You have 90 seconds.', seconds: 90 },
  { id: 'one-minute', name: 'One minute', rule: 'One minute, and room for six things. Go for the essentials.', seconds: 60, bag: 6 },
  { id: 'early-start', name: 'Early start', rule: 'You left on your trigger, so there is more time. Use it well.', seconds: 150 },
  { id: 'late-call', name: 'Late call', rule: 'You left it late. 75 seconds, and room for eight things.', seconds: 75, bag: 8 },
  { id: 'bad-knee', name: 'Bad knee', rule: 'A sore knee slows you down, so you have a little longer.', pace: 0.75, seconds: 150 },
  { id: 'slow-going', name: 'Slow going', rule: 'You are moving slowly today. Plan your path before you go.', pace: 0.8 },
  { id: 'heavy-things', name: 'Heavy things weigh more', rule: 'Every bulky thing you carry slows you down twice as much.', bulkyCost: 0.2 },
  { id: 'smoke-at-the-door', name: 'Smoke at the door', rule: 'The smoke is already thick, and there is less time.', light: 'smoke', seconds: 100 },
  { id: 'quick-feet', name: 'Quick feet', rule: 'You are quick on your feet, but you have only 90 seconds.', pace: 1.2, seconds: 90 },
  { id: 'night', name: 'Night', rule: 'The fire comes at night. The torch counts for more.', light: 'night', weights: { torch: 15 } },
  { id: 'thick-smoke', name: 'Thick smoke', rule: 'Thick smoke fills the house. The P2 masks count for more.', light: 'smoke', weights: { masks: 15 } },
  { id: 'lights-on', name: 'Lights still on', rule: 'The power is still on, so you can see. You have 100 seconds.', light: 'lights-on', seconds: 100 },
  { id: 'no-torch', name: 'No torch', rule: 'The torch is missing and it is dark. A phone light helps, so the phone counts for more.', remove: ['torch'], light: 'night', weights: { charger: 15 } },
  { id: 'pets-come-too', name: 'Pets come too', rule: 'Your pet is coming with you. Its basket and food count for more.', weights: { pet: 15 } },
  { id: 'hot-day', name: 'Hot day', rule: 'It is over 40 degrees. Drinking water counts for more.', weights: { water: 15 } },
  { id: 'no-phone-signal', name: 'No phone signal', rule: 'The phone network is down. The battery radio and spare batteries count for more.', weights: { radio: 15, charger: 4, batteries: 10 } },
  { id: 'medicines-first', name: 'Medicines first', rule: 'Someone at home needs daily medicine. Medicines and first aid count for more.', weights: { medicines: 15, firstaid: 12 } },
  { id: 'papers-count', name: 'Papers count', rule: 'You may be away for weeks. Papers, scans and cash count for more.', weights: { papers: 15, memorystick: 10, cash: 10 } },
  { id: 'radiant-heat', name: 'Radiant heat', rule: 'Radiant heat is fierce today. Wool blankets and long cotton clothes count for more.', weights: { blanket: 15, clothes: 15 } },
  { id: 'days-away', name: 'Days away', rule: 'You may be away for days. Overnight things, hand sanitiser and cash count for more.', weights: { overnight: 12, sanitiser: 10, cash: 10 } },
  { id: 'cannot-replace', name: 'Things you cannot replace', rule: 'Photos and scanned papers count for more. They cannot be replaced.', weights: { photos: 12, memorystick: 12 } },
  { id: 'batteries-matter', name: 'Batteries matter', rule: 'The power may be out for days. The torch, radio and batteries count for more.', weights: { torch: 12, batteries: 12, radio: 12 } },
  { id: 'study-jammed', name: 'Study door jammed', rule: 'The study door is jammed shut. Whatever is in there stays.', lock: ['study'] },
  { id: 'bathroom-locked', name: 'Bathroom locked', rule: 'The bathroom door is locked. Medicines kept there stay behind, so keep some in your kit.', lock: ['bathroom'] },
  { id: 'garage-jammed', name: 'Garage jammed', rule: 'The garage is jammed shut. The torch, radio and masks in there are out of reach.', lock: ['garage'] },
  { id: 'laundry-blocked', name: 'Laundry blocked', rule: 'Boxes block the laundry. Find what you need elsewhere.', lock: ['laundry'] },
  { id: 'two-doors-shut', name: 'Two doors shut', rule: 'The study and the second bedroom are both shut. Make the most of the other rooms.', lock: ['study', 'second bedroom'] },
  { id: 'bedroom-locked', name: 'Bedroom locked', rule: 'The main bedroom is locked. Your phone and clothes in there stay behind.', lock: ['main bedroom'] },
  {
    id: 'kit-by-the-door', name: 'Kit by the door', rule: 'You packed a kit earlier and left it by the front door. Grab it on the way out.',
    move: {
      water: { room: 'living room', x: 22.5, y: 3.6 },
      blanket: { room: 'living room', x: 26.5, y: 4.2 },
      firstaid: { room: 'living room', x: 23.5, y: 8.5 },
      torch: { room: 'living room', x: 22.6, y: 7.6 },
    },
  },
  {
    id: 'spring-clean', name: 'Spring clean', rule: 'Someone tidied up, and things are not where they were. Look in every room.',
    move: {
      torch: { room: 'second bedroom', x: 22.5, y: 21.4 },
      radio: { room: 'kitchen', x: 16.5, y: 8.4 },
      masks: { room: 'laundry', x: 8.0, y: 8.4 },
      medicines: { room: 'kitchen', x: 12.6, y: 5.0 },
    },
  },
  {
    id: 'guests-stayed', name: 'Guests stayed', rule: 'Guests stayed last night. Some of your things are in the second bedroom.',
    move: {
      overnight: { room: 'second bedroom', x: 23.2, y: 18.6 },
      clothes: { room: 'second bedroom', x: 26.0, y: 18.8 },
      charger: { room: 'living room', x: 19.6, y: 5.2 },
    },
  },
  {
    id: 'renovations', name: 'Renovations', rule: 'The house is half packed for builders. Papers are in the garage and bulky things are everywhere.',
    move: {
      papers: { room: 'garage', x: 3.5, y: 8.4 },
      cash: { room: 'main bedroom', x: 1.6, y: 19.6 },
    },
    add: ['golfbag', 'stereo'],
  },
  { id: 'cluttered', name: 'Cluttered house', rule: 'There is more clutter about. Bulky things cost points and slow you down.', add: ['golfbag', 'microwave', 'stereo', 'vase', 'trophy'] },
  { id: 'boots-and-gloves', name: 'Boots and gloves', rule: 'Leather boots, gloves and goggles are in the house. The CFA says to wear them.', add: ['boots', 'gloves', 'goggles'] },
];

/** The classic drill: the house as it is, ten things, two minutes. */
const CLASSIC_SPEC: TwistSpec = { id: 'classic', name: 'Classic', rule: '' };
export const TWIST_IDS: ReadonlySet<string> = new Set(['classic', ...TWISTS.map((twist) => twist.id)]);

/** A twist lasts this many days. */
export const TWIST_PERIOD = 3;

/** The best bag: the `limit` highest positive weights among `items`. */
const bestPoints = (items: DrillItem[], limit: number): number =>
  items
    .map((item) => item.weight)
    .filter((weight) => weight > 0)
    .sort((a, b) => b - a)
    .slice(0, limit)
    .reduce((sum, weight) => sum + weight, 0);

function build(spec: TwistSpec): DrillRules {
  const extras = EXTRA_ITEMS.filter((item) => spec.add?.includes(item.id));
  const items = [...DRILL_ITEMS, ...extras]
    .filter((item) => !spec.remove?.includes(item.id))
    .map((item) => ({ ...item, ...spec.move?.[item.id], weight: spec.weights?.[item.id] ?? item.weight }));
  const cells = (spec.lock ?? []).flatMap((lock) => LOCKS[lock]);
  const closed = new Set(cells.map(([x, y]) => `${x},${y}`));
  const open = reachableCells(closed);
  const reachable = items.filter((item) => withinReach(item.x, item.y, open));
  const bagLimit = spec.bag ?? BAG_LIMIT;
  return {
    twist: spec.id,
    name: spec.name,
    rule: spec.rule,
    bagLimit,
    seconds: spec.seconds ?? DRILL_SECONDS,
    pace: spec.pace ?? 1,
    bulkyCost: spec.bulkyCost ?? 0.1,
    light: LIGHTS[spec.light ?? 'classic'],
    items,
    reachable,
    closed,
    barriers: [...closed].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }),
    maxPoints: bestPoints(reachable, bagLimit),
  };
}

export const CLASSIC: DrillRules = build(CLASSIC_SPEC);
const built = new Map<string, DrillRules>([['classic', CLASSIC]]);

/** The rules for a twist by its id. An id this version does not know (one
 *  written by a later version, say) plays as the classic drill. */
export function rulesFor(id: string): DrillRules {
  const known = built.get(id);
  if (known) return known;
  const spec = TWISTS.find((twist) => twist.id === id);
  if (!spec) return CLASSIC;
  const rules = build(spec);
  built.set(id, rules);
  return rules;
}

/** The twist on a Melbourne calendar day, and how many days it has left,
 *  counting today. Each stretch of three days has one twist; every twist
 *  comes once in each 120 days, in a fresh order each time round. */
export function twistForDay(day: number): { id: string; daysLeft: number } {
  const stretch = Math.floor(day / TWIST_PERIOD);
  return {
    id: TWISTS[cyclePick(stretch, TWISTS.length, 'drill-twist')].id,
    daysLeft: daysLeftInPeriod(day, TWIST_PERIOD),
  };
}
