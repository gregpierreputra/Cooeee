import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = JSON.parse(readFileSync('public/data/index.json', 'utf8')) as {
  layerExtent: { file: string; retrievedAt: number };
};
const snapshot = JSON.parse(
  readFileSync(`public/data/${index.layerExtent.file}`, 'utf8'),
) as {
  retrievedAt: number;
  layers: { BPA: { publishedIn: string[] } };
};

describe('E1-US1-AC6 BPA extent snapshot', () => {
  it('is indexed with matching provenance', () => {
    expect(index.layerExtent.file).toMatch(/^layer-extent\.v\d{4}-\d{2}-\d{2}\.json$/);
    expect(index.layerExtent.retrievedAt).toBe(snapshot.retrievedAt);
    expect(snapshot.layers.BPA.publishedIn.length).toBeGreaterThan(0);
  });

  it.each([
    'MELBOURNE',
    'YARRA',
    'MARIBYRNONG',
    'MOONEE VALLEY',
    'DAREBIN',
    'BOROONDARA',
    'STONNINGTON',
    'GLEN EIRA',
    'MERRI-BEK',
    'PORT PHILLIP',
    'BAYSIDE',
  ])('does not claim BPA publication for metropolitan control %s', (lgaName) => {
    expect(snapshot.layers.BPA.publishedIn).not.toContain(lgaName);
  });
});
