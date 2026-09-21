// E7 — the thirty things in the drill house, and what each is worth.
//
// The weights follow the Country Fire Authority's own list of what to take
// when leaving (its Fire Ready Kit, "what to take with you"). An item on that
// list adds points, an item that is merely harmless adds none, and a bulky
// thing that costs time and space in a car takes points away. The ten heaviest
// essentials add up to exactly 100, so a full bag of the right things is the
// top score and nothing has to be normalised.

export type DrillRoom =
  | 'living room' | 'kitchen' | 'main bedroom' | 'bathroom' | 'laundry'
  | 'study' | 'second bedroom' | 'garage' | 'hall';

export type DrillItem = {
  id: string;
  name: string;
  room: DrillRoom;
  /** Points added to the score when packed. Negative takes points away. */
  weight: number;
  /** One plain sentence for the debrief, said whether the item helped or not. */
  why: string;
  /** Where it stands in the house, in tiles: the middle of its bottom edge. */
  x: number;
  y: number;
};

export const BAG_LIMIT = 10;
export const DRILL_SECONDS = 60;

export const DRILL_ITEMS: DrillItem[] = [
  // living room
  { id: 'photos', name: 'family photos', room: 'living room', weight: 8, why: 'Photos cannot be replaced, and the CFA says to take them.', x: 25.6, y: 6.2 },
  { id: 'television', name: 'television', room: 'living room', weight: -10, why: 'A television is heavy, slow to carry and replaceable.', x: 21.5, y: 2.9 },
  { id: 'console', name: 'games console', room: 'living room', weight: -10, why: 'A games console takes room in the car that water or a blanket needs.', x: 20.4, y: 3.6 },
  { id: 'painting', name: 'framed painting', room: 'living room', weight: -10, why: 'A large frame takes two hands and most of a boot.', x: 19.4, y: 2.4 },
  { id: 'boardgame', name: 'box of toy blocks', room: 'living room', weight: 0, why: 'Toys do no harm, and do not help you get out.', x: 21, y: 5.4 },
  { id: 'lamp', name: 'floor lamp', room: 'living room', weight: -10, why: 'A floor lamp fills the back seat and helps no one.', x: 22.6, y: 3.9 },
  // kitchen
  { id: 'water', name: 'drinking water', room: 'kitchen', weight: 10, why: 'The CFA says to take enough water. Heat and smoke dry you out fast.', x: 13.3, y: 3.5 },
  { id: 'kettle', name: 'kettle', room: 'kitchen', weight: 0, why: 'A kettle changes nothing either way.', x: 14.5, y: 3.4 },
  { id: 'pet', name: 'pet basket and food', room: 'kitchen', weight: 8, why: 'Pets need space in the car and their own food. The CFA says to plan for them.', x: 12.6, y: 8.7 },
  { id: 'plant', name: 'houseplant', room: 'kitchen', weight: -10, why: 'A plant is a pot of soil in a car full of people.', x: 18.4, y: 8.7 },
  // laundry
  { id: 'blanket', name: 'wool blanket', room: 'laundry', weight: 10, why: 'The CFA says to keep wool blankets in the car. Wool shields you from radiant heat.', x: 9.5, y: 3.2 },
  { id: 'batteries', name: 'spare batteries', room: 'laundry', weight: 8, why: 'Spare batteries keep the radio and torch going. They are on the CFA list.', x: 10.4, y: 3.6 },
  { id: 'sanitiser', name: 'hand sanitiser', room: 'laundry', weight: 8, why: 'Hand sanitiser and wipes are on the CFA list for days away from home.', x: 7.5, y: 8.7 },
  // garage
  { id: 'torch', name: 'torch', room: 'garage', weight: 10, why: 'A powerful torch is on the CFA list. Smoke makes midday dark.', x: 1.6, y: 3.5 },
  { id: 'radio', name: 'battery radio', room: 'garage', weight: 10, why: 'A battery radio is on the CFA list. It works when the phone network does not.', x: 2.9, y: 3.5 },
  { id: 'toolbox', name: 'toolbox', room: 'garage', weight: 0, why: 'A toolbox does nothing for the drive out.', x: 5.3, y: 8.7 },
  // main bedroom
  { id: 'medicines', name: 'medicines', room: 'main bedroom', weight: 10, why: 'Medicines are the first thing on the CFA list. A pharmacy may be closed for days.', x: 1.5, y: 17.3 },
  { id: 'overnight', name: 'overnight bag and toiletries', room: 'main bedroom', weight: 8, why: 'A change of clothes and toiletries are on the CFA list.', x: 5.4, y: 21.7 },
  { id: 'pillow', name: 'pillow', room: 'main bedroom', weight: 0, why: 'A pillow is comfort, not readiness.', x: 3.6, y: 18.6 },
  { id: 'clothes', name: 'long sleeved cotton clothes', room: 'main bedroom', weight: 10, why: 'The CFA says to wear long sleeves in natural fibres. Radiant heat burns through thin clothes.', x: 7.5, y: 19.4 },
  // bathroom
  { id: 'firstaid', name: 'first aid kit', room: 'bathroom', weight: 10, why: 'A first aid kit is on the CFA list. Help can be hours away.', x: 12.4, y: 17.3 },
  { id: 'masks', name: 'P2 masks', room: 'bathroom', weight: 10, why: 'P2 masks are on the CFA list. Smoke arrives long before flame.', x: 9.5, y: 21.3 },
  // study
  { id: 'papers', name: 'passport and papers', room: 'study', weight: 10, why: 'Passports, wills and insurance papers are on the CFA list and are hard to replace.', x: 14.3, y: 17.4 },
  { id: 'laptop', name: 'computer', room: 'study', weight: 0, why: 'A computer is neither help nor harm.', x: 15.1, y: 17.4 },
  { id: 'memorystick', name: 'memory stick of scanned papers', room: 'study', weight: 8, why: 'The CFA says to scan papers and photos onto a memory stick.', x: 15.8, y: 17.5 },
  { id: 'books', name: 'books', room: 'study', weight: 0, why: 'Books are replaceable and take no real space.', x: 19.4, y: 18.8 },
  { id: 'cash', name: 'cash and cards', room: 'study', weight: 8, why: 'Cash and cards are on the CFA list. Power and card readers may be out.', x: 14.9, y: 21.3 },
  // second bedroom
  { id: 'charger', name: 'phone and charger', room: 'second bedroom', weight: 10, why: 'The CFA says to take your phone and charger. It is how you hear what is happening.', x: 22.5, y: 17.3 },
  { id: 'guitar', name: 'guitar', room: 'second bedroom', weight: -10, why: 'A guitar takes a whole seat.', x: 26.4, y: 18.1 },
  { id: 'football', name: 'ball', room: 'second bedroom', weight: 0, why: 'A ball is harmless and useless here.', x: 23.6, y: 20.6 },
];

export const DRILL_ITEM_IDS = new Set(DRILL_ITEMS.map((item) => item.id));

export const itemById = (id: string): DrillItem | undefined =>
  DRILL_ITEMS.find((item) => item.id === id);
