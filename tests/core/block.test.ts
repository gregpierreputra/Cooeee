import { describe, expect, it } from 'vitest';
import { BANNED } from '../../src/core/banned-terms';
import * as copy from '../../src/core/copy';
import { BLOCK_ATLAS } from '../../src/core/block-atlas';
import {
  BLOCK_SECONDS,
  HINT_COST,
  WRONG_TAP_COST,
  blockTileView,
  boxOf,
  hazardsForDay,
  highestBlock,
  hintFor,
  hitTest,
  runningScore,
  scoreBlock,
  shownFor,
} from '../../src/core/block';
import { BLOCK_DECOYS, BLOCK_HAZARDS, BLOCK_HAZARD_IDS, BLOCK_PICKS } from '../../src/core/block-hazards';
import { BLOCK_COLS, BLOCK_GRID, BLOCK_ROWS, BLOCK_SCENERY, BLOCK_TILE } from '../../src/core/block-layout';
import type { BlockPlay } from '../../src/core/types';

const banned = new RegExp(`\\b(${BANNED.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
const middle = (sprite: string, x: number, y: number) => {
  const box = boxOf(sprite, x, y);
  return [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] as const;
};

describe('the yard', () => {
  it('is a whole grid of known ground', () => {
    expect(BLOCK_ROWS).toBe(28);
    for (const row of BLOCK_GRID) {
      expect(row).toHaveLength(BLOCK_COLS);
      expect(row).toMatch(/^[FgdvbRWkpSTfcr]+$/);
    }
  });

  it('draws every thing it names', () => {
    for (const piece of BLOCK_SCENERY) expect(BLOCK_ATLAS[piece.sprite], piece.sprite).toBeDefined();
    for (const decoy of BLOCK_DECOYS) expect(BLOCK_ATLAS[decoy.sprite], decoy.sprite).toBeDefined();
    for (const hazard of BLOCK_HAZARDS) {
      expect(BLOCK_ATLAS[hazard.sprite], hazard.sprite).toBeDefined();
      if (hazard.cleared) {
        expect(BLOCK_ATLAS[hazard.cleared], hazard.cleared).toBeDefined();
        // A risk and its cleared look are as wide, so neither gives the place away.
        // (Low groundcover is meant to stand lower than the shrub it replaces.)
        expect(BLOCK_ATLAS[hazard.cleared][2]).toBe(BLOCK_ATLAS[hazard.sprite][2]);
      }
    }
  });

  it('keeps every thing inside the yard', () => {
    for (const thing of [...BLOCK_HAZARDS, ...BLOCK_DECOYS]) {
      const box = boxOf(thing.sprite, thing.x, thing.y);
      expect(box.x0, thing.id).toBeGreaterThanOrEqual(0);
      expect(box.y0, thing.id).toBeGreaterThanOrEqual(0);
      expect(box.x1, thing.id).toBeLessThanOrEqual(BLOCK_COLS * BLOCK_TILE);
      expect(box.y1, thing.id).toBeLessThanOrEqual(BLOCK_ROWS * BLOCK_TILE);
    }
  });
});

describe('the forty risks', () => {
  it('has forty, each with its own id and name, and a dozen harmless things', () => {
    expect(BLOCK_HAZARDS).toHaveLength(40);
    expect(BLOCK_HAZARD_IDS.size).toBe(40);
    expect(new Set(BLOCK_HAZARDS.map((hazard) => hazard.name)).size).toBe(40);
    expect(BLOCK_DECOYS).toHaveLength(12);
  });

  it('explains each in plain words within the wording rules', () => {
    for (const hazard of BLOCK_HAZARDS) {
      expect(hazard.reason, hazard.id).not.toMatch(banned);
      expect(hazard.name, hazard.id).not.toMatch(banned);
      expect(hazard.reason.endsWith('.')).toBe(true);
      expect(hazard.reason).not.toContain('—');
      expect(hazard.reason.length).toBeLessThanOrEqual(140);
    }
  });

  it('can be found by a tap on its middle whenever it is out', () => {
    for (const hazard of BLOCK_HAZARDS) {
      const [x, y] = middle(hazard.sprite, hazard.x, hazard.y);
      expect(hitTest(x, y, [hazard], [], 0), hazard.id).toEqual({ kind: 'hazard', id: hazard.id });
    }
  });

  it('tells a harmless thing by a tap on its middle on a day with no risk near it', () => {
    for (const decoy of BLOCK_DECOYS) {
      const [x, y] = middle(decoy.sprite, decoy.x, decoy.y);
      expect(hitTest(x, y, [], [], 0), decoy.id).toEqual({ kind: 'decoy', id: decoy.id });
    }
  });
});

describe('a day in the yard', () => {
  it('sets out eight different risks, the same all day, no more than three in one part', () => {
    for (let day = 20_700; day < 20_800; day++) {
      const hazards = hazardsForDay(day);
      expect(hazards).toHaveLength(BLOCK_PICKS);
      expect(new Set(hazards.map((hazard) => hazard.id)).size).toBe(BLOCK_PICKS);
      const perZone = new Map<string, number>();
      for (const hazard of hazards) perZone.set(hazard.zone, (perZone.get(hazard.zone) ?? 0) + 1);
      for (const count of perZone.values()) expect(count).toBeLessThanOrEqual(3);
      expect(hazardsForDay(day)).toEqual(hazards);
    }
    expect(hazardsForDay(1)).not.toEqual(hazardsForDay(2));
  });

  it('draws the risks not out as they look once dealt with', () => {
    const hazards = hazardsForDay(20_736);
    const shown = shownFor(hazards);
    for (const hazard of BLOCK_HAZARDS) {
      const thing = shown.find((candidate) => candidate.id === hazard.id);
      if (hazards.includes(hazard)) expect(thing).toMatchObject({ role: 'hazard', sprite: hazard.sprite });
      else if (hazard.cleared) expect(thing).toMatchObject({ role: 'cleared', sprite: hazard.cleared });
      else expect(thing).toBeUndefined();
    }
  });

  it('answers a tap on a found risk, a dealt with one, and open ground', () => {
    const hazards = hazardsForDay(20_736);
    const [first] = hazards;
    const [x, y] = middle(first.sprite, first.x, first.y);
    expect(hitTest(x, y, hazards, [first.id], 0)).toEqual({ kind: 'again', id: first.id });
    const cleared = BLOCK_HAZARDS.find((hazard) => hazard.cleared && !hazards.includes(hazard))!;
    const [cx, cy] = middle(cleared.cleared!, cleared.x, cleared.y);
    expect(hitTest(cx, cy, hazards, [], 0).kind).toMatch(/cleared|hazard|decoy/);
    // The road is open ground.
    expect(hitTest(2, 27 * BLOCK_TILE, hazards, [], 0)).toEqual({ kind: 'nothing' });
  });

  it('forgives a tap a little way off, as far as the padding', () => {
    const hazard = BLOCK_HAZARDS.find((candidate) => candidate.id === 'fuel-can')!;
    const box = boxOf(hazard.sprite, hazard.x, hazard.y);
    expect(hitTest(box.x1 + 3, box.y1 - 2, [hazard], [], 4)).toEqual({ kind: 'hazard', id: 'fuel-can' });
  });
});

describe('the score', () => {
  it('gives an even share for each risk, less wrong taps and hints, between 0 and 100', () => {
    expect(scoreBlock({ found: 8, wrongTaps: 0, hints: 0 })).toBe(100);
    expect(scoreBlock({ found: 4, wrongTaps: 0, hints: 0 })).toBe(50);
    expect(scoreBlock({ found: 1, wrongTaps: 0, hints: 0 })).toBe(13);
    expect(scoreBlock({ found: 8, wrongTaps: 2, hints: 1 })).toBe(100 - 2 * WRONG_TAP_COST - HINT_COST);
    expect(scoreBlock({ found: 0, wrongTaps: 5, hints: 3 })).toBe(0);
    expect(BLOCK_SECONDS).toBe(180);
  });

  // A cost taken below 0 is shown, and a find always adds what it says.
  it('runs below 0 as the game goes, and the final score is held at 0', () => {
    expect(runningScore({ found: 0, wrongTaps: 2, hints: 0 })).toBe(-2 * WRONG_TAP_COST);
    expect(runningScore({ found: 1, wrongTaps: 2, hints: 0 }) - runningScore({ found: 0, wrongTaps: 2, hints: 0 })).toBe(13);
    expect(scoreBlock({ found: 0, wrongTaps: 2, hints: 0 })).toBe(0);
  });

  it('keeps the highest of any play, today and ever', () => {
    const play = (day: number, score: number): BlockPlay => ({
      id: `${day}-${score}`, day, finishedAt: 1, score, hazards: [], found: [], wrongTaps: 0, hints: 0,
    });
    expect(highestBlock([])).toBeNull();
    const plays = [play(1, 40), play(2, 70), play(2, 55)];
    expect(highestBlock(plays)).toBe(70);
    expect(blockTileView(plays, 2)).toEqual({ today: 70, highest: 70 });
    expect(blockTileView(plays, 3)).toEqual({ today: null, highest: 70 });
  });

  it('says the report plainly, as a count of what was found', () => {
    expect(copy.BLOCK_PENALTIES(1, 2)).toBe('1 wrong tap, 2 hints');
    expect(copy.BLOCK_RESULT(6)).toBe('You found six of eight risks');
    expect(copy.BLOCK_RESULT(0)).toBe('You found none of the eight risks');
    expect(copy.BLOCK_RESULT(8)).toBe('You found all eight risks');
  });
});

describe('a hint', () => {
  it('rings a place near a risk not yet found, and nothing once all are found', () => {
    const hazards = hazardsForDay(20_736);
    const hint = hintFor(hazards, [], 20_736, 1)!;
    const target = hazards[0];
    expect(Math.hypot(hint.x - target.x, hint.y - (target.y - BLOCK_ATLAS[target.sprite][3] / BLOCK_TILE / 2))).toBeLessThan(hint.radius);
    expect(hintFor(hazards, [hazards[0].id], 20_736, 2)).not.toBeNull();
    expect(hintFor(hazards, hazards.map((hazard) => hazard.id), 20_736, 3)).toBeNull();
  });
});

describe('the risks dealt with', () => {
  it('names every look a dealt-with risk has, so a tap on it says what is there', () => {
    for (const hazard of BLOCK_HAZARDS) {
      if (hazard.cleared) expect(hazard.clearedName, hazard.id).toMatch(/^[a-z].+[a-z]$/);
      else expect(hazard.clearedName, hazard.id).toBeUndefined();
    }
  });
});
