import { describe, expect, it } from 'vitest';
import { DRILL_ITEMS } from '../../src/core/drill-items';
import { FURNITURE } from '../../src/core/drill-layout';
import { ATLAS } from '../../src/core/drill-atlas';

describe('E7 the drill pictures', () => {
  it('has a picture for every piece of furniture, every item and the figure', () => {
    const needed = [...FURNITURE.map((piece) => piece.sprite), ...DRILL_ITEMS.map((item) => item.id), 'idle', 'walk', 'pick', 'cat', 'arrow'];
    for (const key of needed) expect(ATLAS[key], key).toBeDefined();
  });
});
