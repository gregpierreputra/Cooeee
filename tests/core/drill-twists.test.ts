import { describe, expect, it } from 'vitest';
import { BANNED } from '../../src/core/banned-terms';
import * as copy from '../../src/core/copy';
import { ATLAS } from '../../src/core/drill-atlas';
import { highestForTwist } from '../../src/core/drill-history';
import { BAG_LIMIT, DRILL_ITEMS, DRILL_SECONDS, EXTRA_ITEMS, MAX_BAG } from '../../src/core/drill-items';
import { REACH, SPAWN, pathTo, reachableCells } from '../../src/core/drill-house';
import { GRID, ROOM_OF } from '../../src/core/drill-layout';
import { leavingEarly, nearestItem, speedFor, step, haze, SPEED } from '../../src/core/drill-play';
import { leftBehind, scoreDrill } from '../../src/core/drill-score';
import { CLASSIC, TWISTS, TWIST_IDS, TWIST_PERIOD, rulesFor, twistForDay } from '../../src/core/drill-twists';
import type { Drill } from '../../src/core/types';

// The room a point is in, read straight from the house plan.
const roomAt = (x: number, y: number) => ROOM_OF[GRID[Math.floor(y)]?.[Math.floor(x)] ?? ''] ?? null;

const bestBag = (twist: string) => {
  const rules = rulesFor(twist);
  return [...rules.reachable]
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, rules.bagLimit)
    .map((item) => item.id);
};
const banned = new RegExp(`\\b(${BANNED.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

describe('the drill twists', () => {
  it('has forty, each with its own id and name', () => {
    expect(TWISTS).toHaveLength(40);
    expect(new Set(TWISTS.map((twist) => twist.id)).size).toBe(40);
    expect(new Set(TWISTS.map((twist) => twist.name)).size).toBe(40);
    expect(TWIST_IDS.has('classic')).toBe(true);
    expect(TWIST_IDS.size).toBe(41);
  });

  it('plays the classic drill exactly as before', () => {
    expect(CLASSIC.bagLimit).toBe(BAG_LIMIT);
    expect(CLASSIC.seconds).toBe(DRILL_SECONDS);
    expect(CLASSIC.items).toEqual(DRILL_ITEMS);
    expect(CLASSIC.reachable).toHaveLength(DRILL_ITEMS.length);
    expect(CLASSIC.maxPoints).toBe(100);
    expect(rulesFor('classic')).toBe(CLASSIC);
    expect(rulesFor('not-a-twist')).toBe(CLASSIC);
  });

  it.each(TWISTS.map((twist) => twist.id))('%s scores its best bag 100 and an empty bag 0', (id) => {
    const rules = rulesFor(id);
    expect(rules.maxPoints).toBeGreaterThan(0);
    expect(scoreDrill(bestBag(id), rules)).toBe(100);
    expect(scoreDrill([], rules)).toBe(0);
    expect(rules.bagLimit).toBeGreaterThanOrEqual(5);
    expect(rules.bagLimit).toBeLessThanOrEqual(MAX_BAG);
    expect(rules.seconds).toBeGreaterThanOrEqual(60);
    expect(rules.seconds).toBeLessThanOrEqual(150);
  });

  it.each(TWISTS.map((twist) => twist.id))('%s puts every thing where it can be drawn and, unless shut away, reached', (id) => {
    const rules = rulesFor(id);
    const open = reachableCells(rules.closed);
    for (const item of rules.items) {
      expect(ATLAS[item.id], item.id).toBeDefined();
      const reachable = rules.reachable.includes(item);
      // A thing that should be in reach is within an arm of a cell the figure can walk to.
      if (reachable) {
        const near = [...open].some((key) => {
          const [x, y] = key.split(',').map(Number);
          return Math.hypot(x + 0.5 - item.x, y + 0.5 - item.y) <= REACH;
        });
        expect(near, item.id).toBe(true);
      }
    }
    if (rules.closed.size === 0) expect(rules.reachable).toHaveLength(rules.items.length);
    if (rules.barriers.length > 0) expect(ATLAS.barrier).toBeDefined();
  });

  it('shuts doorways so the rooms behind them cannot be reached', () => {
    const study = rulesFor('study-jammed');
    expect(study.reachable.map((item) => item.id)).not.toContain('papers');
    expect(study.reachable.map((item) => item.id)).toContain('torch');
    const garage = rulesFor('garage-jammed');
    expect(garage.reachable.map((item) => item.id)).not.toContain('torch');
    // A walk into the shut study stops short of it.
    const path = pathTo(SPAWN.x, SPAWN.y, 16.5, 19.5, study.closed);
    const end = path.at(-1)!;
    expect(roomAt(end.x, end.y)).not.toBe('study');
  });

  it('leaves out of the debrief what was shut away', () => {
    const study = rulesFor('study-jammed');
    expect(leftBehind([], study).map((item) => item.id)).not.toContain('papers');
    expect(leftBehind([], CLASSIC).map((item) => item.id)).toContain('papers');
  });

  it('weighs things anew, and counts a heavier essential as essential', () => {
    const night = rulesFor('night');
    expect(night.items.find((item) => item.id === 'torch')?.weight).toBe(15);
    expect(leftBehind([], night).map((item) => item.id)).toContain('torch');
    const signal = rulesFor('no-phone-signal');
    expect(leftBehind([], signal).map((item) => item.id)).not.toContain('charger');
  });

  it('adds and moves things only in their twists', () => {
    expect(rulesFor('cluttered').items.map((item) => item.id)).toEqual(expect.arrayContaining(['golfbag', 'microwave', 'stereo', 'vase', 'trophy']));
    expect(CLASSIC.items.some((item) => EXTRA_ITEMS.includes(item))).toBe(false);
    const kit = rulesFor('kit-by-the-door');
    expect(kit.items.find((item) => item.id === 'water')).toMatchObject({ room: 'living room', x: 22.5 });
    expect(rulesFor('no-torch').items.map((item) => item.id)).not.toContain('torch');
  });

  it('changes pace, bulk, light and time', () => {
    expect(speedFor([], rulesFor('bad-knee'))).toBeCloseTo(SPEED * 0.75);
    expect(speedFor(['television'], rulesFor('heavy-things'))).toBeCloseTo(SPEED * 0.8);
    expect(speedFor(['television'])).toBeCloseTo(SPEED * 0.9);
    expect(haze(0, 120, rulesFor('night').light).dark).toBeGreaterThan(haze(0, 120).dark);
    expect(rulesFor('lights-on').light.powered).toBe(true);
    expect(leavingEarly(80, true, 90)).toBe(false);
    expect(leavingEarly(74, true, 90)).toBe(true);
    expect(nearestItem(1.6, 4, [], rulesFor('spring-clean'))?.id).not.toBe('torch');
    expect(step(SPAWN.x, SPAWN.y, 1, 0, 0.1, SPEED, new Set())).toBeDefined();
  });

  it('keeps every name and rule plain and within the wording rules', () => {
    for (const twist of TWISTS) {
      expect(twist.name, twist.id).not.toMatch(banned);
      expect(twist.rule, twist.id).not.toMatch(banned);
      expect(twist.rule).not.toContain('—');
      expect(twist.rule.endsWith('.')).toBe(true);
    }
  });
});

describe('which twist is on', () => {
  it('holds one twist for each stretch of three days', () => {
    for (let start = 0; start < 300; start += TWIST_PERIOD) {
      const ids = [0, 1, 2].map((i) => twistForDay(start + i).id);
      expect(new Set(ids).size).toBe(1);
      expect([0, 1, 2].map((i) => twistForDay(start + i).daysLeft)).toEqual([3, 2, 1]);
    }
  });

  it('shows all forty in each 120 days, never the same one twice running', () => {
    const base = 20_736 - (20_736 % 120);
    const ids = Array.from({ length: 40 }, (_, i) => twistForDay(base + i * TWIST_PERIOD).id);
    expect(new Set(ids).size).toBe(40);
    for (let day = 0; day < 1200; day += TWIST_PERIOD) {
      expect(twistForDay(day + TWIST_PERIOD).id).not.toBe(twistForDay(day).id);
    }
  });
});

describe('the twist on screen', () => {
  it('reads exactly as the classic drill did for the classic drill', () => {
    expect(copy.DRILL_INTRO_HEADING_FOR(120)).toBe(copy.DRILL_INTRO_HEADING);
    expect(copy.DRILL_CLOCK(120)).toBe('2:00');
    expect(copy.DRILL_CLOCK(90)).toBe('1:30');
    expect(copy.DRILL_CLOCK(5)).toBe('0:05');
    expect(copy.DRILL_TOUR_LINES_FOR(120, 10, false)).toEqual(copy.DRILL_TOUR_LINES);
    expect(copy.DRILL_TILE_DETAIL_FOR(120, 10)).toBe(copy.DRILL_TILE_DETAIL);
  });

  it('says the time and the bag in words', () => {
    expect(copy.TIME_WORDS(60)).toBe('one minute');
    expect(copy.TIME_WORDS(90)).toBe('90 seconds');
    expect(copy.TIME_WORDS(150)).toBe('two and a half minutes');
    expect(copy.DRILL_INTRO_HEADING_FOR(90)).toBe('90 seconds to leave');
    expect(copy.DRILL_TILE_CHANGES(1)).toBe('Changes tomorrow');
    expect(copy.DRILL_TILE_CHANGES(3)).toBe('Changes in three days');
    expect(copy.DRILL_TOUR_LINES_FOR(100, 10, true)[0].text).toContain('lights are still on');
  });
});

describe('the highest score under a twist', () => {
  const drill = (twist: string | undefined, score: number): Drill => ({
    id: `${twist}-${score}`, packId: 'p', finishedAt: 1, reachedDoor: true, score, packed: [], ...(twist ? { twist } : {}),
  });
  it('compares only drills under the same twist, an untwisted drill counting as classic', () => {
    const drills = [drill(undefined, 70), drill('night', 90), drill('classic', 60), drill('night', 40)];
    expect(highestForTwist(drills, 'classic')).toBe(70);
    expect(highestForTwist(drills, 'night')).toBe(90);
    expect(highestForTwist(drills, 'small-bag')).toBeNull();
  });
});
