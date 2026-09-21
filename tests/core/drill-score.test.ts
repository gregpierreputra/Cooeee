import { describe, expect, it } from 'vitest';
import { DRILL_FACTS } from '../../src/core/copy';
import { BAG_LIMIT, DRILL_ITEMS } from '../../src/core/drill-items';
import { debriefRows, leftBehind, scoreBreakdown, scoreDrill, topTenTotal } from '../../src/core/drill-score';

const ids = (weight: (w: number) => boolean) => DRILL_ITEMS.filter((item) => weight(item.weight)).map((item) => item.id);

describe('E7 the drill score', () => {
  it('holds thirty items with unique ids, and the top ten add up to 100', () => {
    expect(DRILL_ITEMS).toHaveLength(30);
    expect(new Set(DRILL_ITEMS.map((item) => item.id)).size).toBe(30);
    expect(topTenTotal()).toBe(100);
  });

  it('scores a full bag of the heaviest essentials 100 and an empty bag 0', () => {
    const best = [...DRILL_ITEMS].sort((a, b) => b.weight - a.weight).slice(0, BAG_LIMIT).map((item) => item.id);
    expect(scoreDrill(best)).toBe(100);
    expect(scoreDrill([])).toBe(0);
  });

  it('takes points for a distraction, never below 0, and ignores unknown ids', () => {
    const [essential] = ids((w) => w === 10);
    const [distraction] = ids((w) => w < 0);
    expect(scoreDrill([essential, distraction])).toBe(0);
    expect(scoreDrill([essential, essential, distraction])).toBe(10);
    expect(scoreDrill(['not-a-thing', essential])).toBe(10);
    expect(scoreDrill(ids((w) => w < 0))).toBe(0);
  });

  it('explains each packed item in the order it was packed', () => {
    const [neutral] = ids((w) => w === 0);
    const [distraction] = ids((w) => w < 0);
    const rows = debriefRows([distraction, neutral, 'not-a-thing']);
    expect(rows.map((row) => [row.item.id, row.effect])).toEqual([[distraction, 'took'], [neutral, 'nothing']]);
  });

  it('names every essential that stayed in the house', () => {
    expect(leftBehind([])).toHaveLength(10);
    expect(leftBehind(['torch'])).toHaveLength(9);
    expect(leftBehind([]).every((item) => item.weight === 10)).toBe(true);
    expect(leftBehind(ids((w) => w === 10))).toEqual([]);
  });

  it('sorts the bag into groups whose points add up to the raw score', () => {
    const bag = ['torch', 'cash', 'kettle', 'television', 'not an item'];
    const groups = scoreBreakdown(bag);
    expect(groups.map((group) => [group.kind, group.items.length, group.points])).toEqual([
      ['essential', 1, 10], ['listed', 1, 8], ['neutral', 1, 0], ['bulky', 1, -10],
    ]);
    expect(groups.reduce((sum, group) => sum + group.points, 0)).toBe(scoreDrill(bag));
  });

  it('highlights only phrases that are in the fact, word for word', () => {
    for (const fact of DRILL_FACTS) for (const key of fact.key) expect(fact.text, key).toContain(key);
  });
});
