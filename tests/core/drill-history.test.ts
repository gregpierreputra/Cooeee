import { describe, expect, it } from 'vitest';
import { drillRows, highestScore } from '../../src/core/drill-history';
import type { Drill } from '../../src/core/types';

const drill = (over: Partial<Drill>): Drill => ({
  id: 'a', packId: 'p', finishedAt: 1_700_000_000_000, reachedDoor: true, score: 50, packed: ['water'], ...over,
});

describe('E9 the drill record', () => {
  it('lists drills newest first in the debrief wording', () => {
    const rows = drillRows([drill({ id: 'old' }), drill({ id: 'new', finishedAt: 1_800_000_000_000, reachedDoor: false, score: 0, packed: [] })]);
    expect(rows.map((row) => row.id)).toEqual(['new', 'old']);
    expect(rows[0].outcome).toBe('Away from the door when time ran out');
    expect(rows[1].outcome).toBe('At the door, 50 out of 100');
    expect(rows[1].packed).toBe('1 thing packed');
  });

  it('names the essentials packed and left behind, and what cost points, from the bag alone', () => {
    const [row] = drillRows([drill({ packed: ['water', 'medicines', 'television', 'kettle'] })]);
    expect(row.essentials).toBe('2 of 10 essentials packed');
    expect(row.leftBehind).toHaveLength(8);
    expect(row.leftBehind).not.toContain('drinking water');
    expect(row.leftBehind).toContain('first aid kit');
    expect(row.costYou).toEqual(['television']);
    expect(row.items).toEqual(['drinking water', 'medicines', 'television', 'kettle']);
  });

  it('finds the highest score among drills that reached the door', () => {
    expect(highestScore([])).toBeNull();
    expect(highestScore([drill({ reachedDoor: false, score: 0 })])).toBeNull();
    expect(highestScore([drill({ score: 40 }), drill({ score: 80 }), drill({ reachedDoor: false, score: 0 })])).toBe(80);
  });
});
