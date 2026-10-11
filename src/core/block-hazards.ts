// Ready the Block — the forty fire risks a yard can hold, and the harmless
// things beside them. Each risk follows the Country Fire Authority's guide to
// preparing a property, and says in one plain line why it matters and what
// to do. Each day picks eight of them (block.ts); the rest are drawn as they
// look once dealt with, or not drawn at all.
//
// The ids are stored with every play on the phone. Never rename or remove
// one; add new risks at the end.

export type BlockZone = 'roof' | 'walls' | 'deck' | 'yard' | 'shed';

export type BlockHazard = {
  id: string;
  /** What it is, as the debrief and the found message name it. */
  name: string;
  /** One or two sentences: why it is a risk, and what to do. */
  reason: string;
  zone: BlockZone;
  /** The middle of its bottom edge, in tiles. */
  x: number;
  y: number;
  sprite: string;
  /** How it looks once dealt with, or null when dealt with means gone. */
  cleared: string | null;
};

/** A harmless thing in the yard. Tapping it says so, and costs a little. */
export type BlockDecoy = { id: string; name: string; sprite: string; x: number; y: number };

export const BLOCK_SOURCE = 'Country Fire Authority';

export const BLOCK_HAZARDS: readonly BlockHazard[] = [
  // the roof
  { id: 'gutter-front', name: 'leaves in the front gutter', reason: 'Embers land in gutters and set dry leaves alight. Clear them before summer and through the fire season.', zone: 'roof', x: 13.0, y: 14.05, sprite: 'gutterLeaves', cleared: null },
  { id: 'gutter-back', name: 'leaves in the back gutter', reason: 'Gutters at the back catch embers too. Clear every gutter, not just the ones seen from the street.', zone: 'roof', x: 20.0, y: 6.5, sprite: 'gutterLeavesBack', cleared: null },
  { id: 'roof-leaves', name: 'leaves on the roof', reason: 'Leaves and twigs on a roof catch embers. Clear them off along with the gutters.', zone: 'roof', x: 19.5, y: 11.6, sprite: 'roofLeaves', cleared: null },
  { id: 'roof-gap', name: 'a broken roof tile', reason: 'Embers get in through a broken tile and can light the roof space. Replace broken tiles.', zone: 'roof', x: 24.5, y: 12.0, sprite: 'roofGap', cleared: null },
  { id: 'whirlybird', name: 'a roof vent with no mesh', reason: 'Embers can drop through an open roof vent. Cover vents with fine metal mesh.', zone: 'roof', x: 12.0, y: 8.8, sprite: 'whirlybirdOpen', cleared: 'whirlybirdMeshed' },
  { id: 'cooler', name: 'an air cooler with no ember screen', reason: 'Embers can be drawn into an evaporative cooler. Fit metal ember screens to it.', zone: 'roof', x: 22.5, y: 8.6, sprite: 'coolerOpen', cleared: 'coolerScreened' },
  { id: 'branch-roof', name: 'a branch over the roof', reason: 'Branches over the roof drop leaves into gutters and can carry fire to the house. Cut them back.', zone: 'roof', x: 8.6, y: 7.4, sprite: 'branchOverRoof', cleared: null },
  // the walls
  { id: 'vent-left', name: 'an open wall vent', reason: 'Embers blow in through open vents. Cover wall vents with fine metal mesh.', zone: 'walls', x: 13.5, y: 15.7, sprite: 'ventOpen', cleared: 'ventMeshed' },
  { id: 'vent-right', name: 'an open vent by the corner', reason: 'Embers blow in through open vents. Cover every wall vent with fine metal mesh.', zone: 'walls', x: 24.8, y: 15.7, sprite: 'ventOpen', cleared: 'ventMeshed' },
  { id: 'door-gap', name: 'a gap under the front door', reason: 'Embers blow in under doors. Seal the gap with a draught strip.', zone: 'walls', x: 17.5, y: 16.0, sprite: 'doorGap', cleared: 'doorSeal' },
  { id: 'window-bare', name: 'a window with no metal flyscreen', reason: 'Metal flyscreens keep embers out of open or broken windows. Fit them to every window.', zone: 'walls', x: 9.6, y: 15.5, sprite: 'windowBare', cleared: 'windowScreened' },
  { id: 'eave-gap', name: 'a gap under the eaves', reason: 'Embers get into the roof space through gaps under the eaves. Seal them.', zone: 'walls', x: 11.0, y: 14.35, sprite: 'eaveGap', cleared: null },
  { id: 'creeper', name: 'a creeper on the wall', reason: 'A creeper on a wall can carry fire up to the eaves and windows. Remove it.', zone: 'walls', x: 15.6, y: 16.0, sprite: 'creeper', cleared: null },
  { id: 'shrub-window', name: 'a tall shrub under the window', reason: 'A tall shrub under a window can burn hot enough to break the glass. Keep plants by the house low and sparse.', zone: 'walls', x: 9.5, y: 17.95, sprite: 'shrubTall', cleared: 'groundcover' },
  { id: 'bark-mulch', name: 'bark mulch against the wall', reason: 'Bark mulch catches embers and smoulders. Use gravel or stones next to the house.', zone: 'walls', x: 7.5, y: 17.95, sprite: 'barkMulch', cleared: 'gravelBed' },
  { id: 'woodpile-house', name: 'firewood stacked against the house', reason: 'Firewood against a wall can set the house alight. Store it well away from buildings.', zone: 'walls', x: 28.3, y: 13.9, sprite: 'woodpile', cleared: null },
  { id: 'gas-valve', name: 'a gas cylinder valve facing the house', reason: 'Gas cylinders should be secured with their valves facing away from the house.', zone: 'walls', x: 27.5, y: 11.0, sprite: 'gasIn', cleared: 'gasOut' },
  { id: 'paper-bin', name: 'a bin of paper against the wall', reason: 'A bin of paper and cardboard catches embers easily. Keep it away from the house.', zone: 'walls', x: 27.5, y: 8.6, sprite: 'binAgainstWall', cleared: null },
  { id: 'fence-join', name: 'a timber fence joined to the house', reason: 'A timber fence touching the house can lead fire straight to it. Use metal where a fence meets the house.', zone: 'walls', x: 27.5, y: 16.0, sprite: 'fenceJoinTimber', cleared: 'fenceJoinMetal' },
  // the deck and veranda
  { id: 'doormat', name: 'a coir doormat', reason: 'A coir doormat catches embers right at the door. Use a rubber or metal mat.', zone: 'deck', x: 17.5, y: 16.9, sprite: 'doormatCoir', cleared: 'doormatRubber' },
  { id: 'cushions', name: 'cushions on the outdoor chairs', reason: 'Cushions catch embers. Bring outdoor cushions inside on hot, windy days.', zone: 'deck', x: 21.5, y: 17.9, sprite: 'chairsCushions', cleared: 'chairsBare' },
  { id: 'boxes', name: 'boxes and papers on the veranda', reason: 'Boxes and papers on a veranda catch embers. Clear the veranda of anything that burns.', zone: 'deck', x: 13.5, y: 17.9, sprite: 'boxesStack', cleared: null },
  { id: 'fuel-can', name: 'a fuel can by the door', reason: 'Fuel near the house feeds a fire. Store fuel well away from the house.', zone: 'deck', x: 19.4, y: 17.3, sprite: 'fuelCan', cleared: null },
  { id: 'deck-leaves', name: 'leaves piled on the deck', reason: 'Embers settle where leaves gather on a deck. Sweep decks and verandas clear.', zone: 'deck', x: 11.9, y: 17.95, sprite: 'leafPile', cleared: null },
  { id: 'under-deck', name: 'leaves and rubbish under the deck', reason: 'Embers blow under decks and light what is there. Clear underneath and close the gap with metal mesh.', zone: 'deck', x: 15.8, y: 18.35, sprite: 'deckGapDebris', cleared: 'deckMesh' },
  { id: 'patio-heater', name: 'a patio heater on the veranda', reason: 'A gas bottle on the veranda adds fuel right beside the house. Move it away for the fire season.', zone: 'deck', x: 24.0, y: 17.6, sprite: 'patioHeater', cleared: null },
  { id: 'hanging-basket', name: 'a dry hanging basket', reason: 'Dry plants in a hanging basket catch embers beside the walls. Take them down for summer.', zone: 'deck', x: 25.9, y: 15.2, sprite: 'basketDry', cleared: null },
  // the yard
  { id: 'grass-front', name: 'long dry grass in the front yard', reason: 'Long dry grass carries fire to the house. Keep grass short, 10 centimetres or less.', zone: 'yard', x: 10.0, y: 21.6, sprite: 'longGrass', cleared: null },
  { id: 'grass-back', name: 'long dry grass in the back yard', reason: 'Long dry grass carries fire to the house. Mow the back as well as the front.', zone: 'yard', x: 12.5, y: 3.8, sprite: 'longGrass', cleared: null },
  { id: 'clippings', name: 'a heap of grass clippings', reason: 'Dry clippings are fine fuel. Take them away rather than leaving them in a heap.', zone: 'yard', x: 21.2, y: 4.9, sprite: 'clippings', cleared: null },
  { id: 'garden-waste', name: 'a pile of garden waste', reason: 'Cut branches and dry leaves feed a fire. Remove garden waste before the fire season.', zone: 'yard', x: 31.0, y: 12.8, sprite: 'wastePile', cleared: null },
  { id: 'ladder-fuel', name: 'shrubs under the gum tree', reason: 'Shrubs under a tree let fire climb into the canopy. Clear them and remove low branches.', zone: 'yard', x: 31.5, y: 21.95, sprite: 'ladderShrubs', cleared: null },
  { id: 'short-hose', name: 'a hose too short to reach', reason: 'Hoses need to reach all the way round the house. Check each one before summer.', zone: 'yard', x: 29.5, y: 15.2, sprite: 'hoseShort', cleared: 'hoseLong' },
  { id: 'hose-off', name: 'a hose off its tap', reason: 'Keep hoses connected to their taps, so they are ready to use.', zone: 'yard', x: 30.5, y: 9.4, sprite: 'hoseOff', cleared: 'hoseOn' },
  { id: 'no-ladder', name: 'no ladder to reach the roof', reason: 'A ladder lets you reach the roof to clear gutters. Keep one where it is easy to find.', zone: 'yard', x: 31.6, y: 5.6, sprite: 'hooksEmpty', cleared: 'ladderOnHooks' },
  { id: 'fallen-branches', name: 'fallen branches under the tree', reason: 'Fallen branches and bark are fuel. Pick them up and take them away.', zone: 'yard', x: 5.9, y: 5.5, sprite: 'fallenBranches', cleared: null },
  // the shed and fence
  { id: 'shed-gutter', name: 'leaves in the shed gutter', reason: 'Sheds catch embers too. Clear shed gutters along with the house gutters.', zone: 'shed', x: 30.5, y: 4.05, sprite: 'shedGutterLeaves', cleared: null },
  { id: 'shed-open', name: 'an open shed full of paint tins', reason: 'Paint and chemicals burn fiercely. Store them closed away, well clear of the house.', zone: 'shed', x: 29.5, y: 6.0, sprite: 'shedOpen', cleared: 'shedClosed' },
  { id: 'woodpile-shed', name: 'firewood stacked against the shed', reason: 'A woodpile against a shed can set it alight. Stack firewood away from all buildings.', zone: 'shed', x: 27.2, y: 5.9, sprite: 'woodpile', cleared: null },
  { id: 'fence-litter', name: 'leaves along the fence', reason: 'Leaves gathered along a fence carry fire along it. Rake them up and take them away.', zone: 'shed', x: 34.7, y: 19.0, sprite: 'fenceLitter', cleared: null },
];

export const BLOCK_DECOYS: readonly BlockDecoy[] = [
  { id: 'clothesline', name: 'The clothesline', sprite: 'clothesline', x: 17.0, y: 4.6 },
  { id: 'letterbox', name: 'The letterbox', sprite: 'letterbox', x: 20.5, y: 23.9 },
  { id: 'birdbath', name: 'The bird bath', sprite: 'birdbath', x: 24.0, y: 20.6 },
  { id: 'gnome', name: 'The garden gnome', sprite: 'gnome', x: 12.5, y: 19.6 },
  { id: 'bench', name: 'The metal bench', sprite: 'bench', x: 27.0, y: 19.8 },
  { id: 'bike', name: 'The bicycle', sprite: 'bike', x: 5.0, y: 16.4 },
  { id: 'car', name: 'The car', sprite: 'car', x: 3.5, y: 12.9 },
  { id: 'solar', name: 'The solar panels', sprite: 'solar', x: 15.0, y: 12.4 },
  { id: 'tank', name: 'The water tank', sprite: 'tank', x: 24.6, y: 5.0 },
  { id: 'kerb-bins', name: 'The bins at the kerb', sprite: 'kerbBins', x: 8.0, y: 25.6 },
  { id: 'cat', name: 'The cat', sprite: 'cat', x: 19.8, y: 21.2 },
  { id: 'wheelbarrow', name: 'The wheelbarrow', sprite: 'wheelbarrow', x: 14.5, y: 22.0 },
];

export const BLOCK_HAZARD_IDS: ReadonlySet<string> = new Set(BLOCK_HAZARDS.map((hazard) => hazard.id));

/** How many risks a day's yard holds. */
export const BLOCK_PICKS = 8;
