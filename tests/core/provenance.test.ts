import { describe, expect, it } from 'vitest';

import { MS_PER_DAY } from '../../src/core/constants';
import * as copy from '../../src/core/copy';
import { absenceRow } from '../../src/core/destination';
import {
  decideOriginalSourceAccess,
  formatSavedDate,
  hasCompleteSource,
  isAllowedSourceUrl,
  missingDisplayProvenance,
  packDetailAbsence,
  packDetailItems,
  prepareProvenancedContent,
  provenanceView,
  savedAgeDays,
} from '../../src/core/provenance';
import type { CompletePackContent, PackSeed, TextPackContent } from '../../src/core/types';
import { destination, pack, program, source } from '../fixtures';

const NOW = Date.UTC(2026, 7, 29, 12);
const daysAgo = (days: number) => NOW - days * MS_PER_DAY;

function seed(): PackSeed {
  const complete = pack();
  const { status, verifiedAt, builtWithTiles, sizeBytes, manifest, ...value } = complete;
  void status;
  void verifiedAt;
  void builtWithTiles;
  void sizeBytes;
  void manifest;
  return value;
}

const layer = {
  id: 'pack-1:BPA',
  packId: 'pack-1',
  group: 'designation' as const,
  code: 'BPA' as const,
  status: 'present' as const,
  features: [],
  checkedAt: NOW,
  source: source({ publisher: 'Department of Transport and Planning', retrievedAt: daysAgo(1) }),
};

describe('E1-US2 saved date and age', () => {
  it('formats day, full month name and year with no leading zero', () => {
    expect(formatSavedDate(Date.UTC(2026, 2, 3, 1))).toBe('3 March 2026');
  });

  it.each([
    [29, false],
    [30, false],
    [31, true],
  ])('marks day %i stale only after the inclusive 30-day window', (days, stale) => {
    expect(provenanceView(NOW, source({ retrievedAt: daysAgo(days) })).stale).toBe(stale);
  });

  it('shows the exact publisher/date line and same-day wording', () => {
    expect(provenanceView(NOW, source({ retrievedAt: NOW }))).toEqual({
      publisherLine: `Published by Country Fire Authority · Saved ${formatSavedDate(NOW)}`,
      ageLine: copy.SAVED_TODAY,
      stale: false,
    });
  });

  it('shows whole elapsed days without rounding a partial day up', () => {
    expect(savedAgeDays(NOW, daysAgo(2) + 1)).toBe(1);
    expect(provenanceView(NOW, source({ retrievedAt: daysAgo(2) })).ageLine).toBe('2 days ago');
  });

  it('treats a future device timestamp as today instead of showing a negative age', () => {
    expect(savedAgeDays(NOW, NOW + MS_PER_DAY)).toBe(0);
  });
});

describe('E1-US2 required provenance', () => {
  it('distinguishes missing publisher from missing saved date', () => {
    expect(missingDisplayProvenance(source({ publisher: '  ' }))).toBe('publisher');
    expect(missingDisplayProvenance(source({ retrievedAt: 0 }))).toBe('saved-date');
    expect(missingDisplayProvenance(source())).toBeNull();
  });

  it('requires URL and licence in addition to display provenance', () => {
    expect(hasCompleteSource(source())).toBe(true);
    expect(hasCompleteSource(source({ url: '' }))).toBe(false);
    expect(hasCompleteSource(source({ licence: '' }))).toBe(false);
  });

  it('omits malformed items without changing complete items or the pack seed', () => {
    const invalidDestination = destination({
      id: 'pack-1:missing-publisher',
      source: source({ publisher: '' }),
    });
    const invalidRecovery = program({
      id: 'missing-date',
      source: source({ retrievedAt: Number.NaN }),
    });
    const input: TextPackContent = {
      pack: seed(),
      layers: [layer],
      destinations: [destination(), invalidDestination],
      recovery: [program(), invalidRecovery],
    };

    const result = prepareProvenancedContent(input);

    expect(result.content.pack).toBe(input.pack);
    expect(result.content.layers).toEqual([layer]);
    expect(result.content.destinations).toEqual([destination()]);
    expect(result.content.recovery).toEqual([program()]);
    expect(result.omittedItems).toEqual([
      { id: 'pack-1:missing-publisher', missing: 'publisher' },
      { id: 'missing-date', missing: 'saved-date' },
    ]);
  });
});

describe('E1-US2 original source links', () => {
  it('always requires an explanation before the browser may leave Cooeee', () => {
    const item = { id: 'source-1', name: 'Official source', source: source() };
    expect(decideOriginalSourceAccess(item)).toEqual({
      kind: 'explain-before-open',
      item,
    });
  });

  it.each([
    'https://servicesaustralia.gov.au/example',
    'https://opendata.maps.vic.gov.au/example',
    'https://www.cfa.vic.gov.au/plan-prepare',
  ])('allows the reviewed HTTPS source %s', (url) => {
    expect(isAllowedSourceUrl(url)).toBe(true);
  });

  it.each([
    'http://servicesaustralia.gov.au/example',
    'https://vic.gov.au.attacker.example/',
    'not a URL',
  ])('rejects an unreviewed or non-HTTPS source %s', (url) => {
    expect(isAllowedSourceUrl(url)).toBe(false);
  });
});

describe('E1-US2 pack item projection', () => {
  it('maps every stored row and an attributed basemap without ranking or dropping items', () => {
    const content: CompletePackContent = {
      pack: pack({
        builtWithTiles: true,
        sources: [source({ publisher: 'OpenStreetMap contributors', licence: 'ODbL' })],
      }),
      layers: [layer],
      destinations: [destination()],
      recovery: [program()],
      recoveryVerified: true,
    };

    expect(packDetailItems(content).map(({ name }) => name)).toEqual([
      'Designated Bushfire Prone Area',
      'Example Reserve',
      'Example payment',
      'Offline basemap',
    ]);
  });

  // The reported defect: a pack whose stored BPA status was an absence still
  // rendered as "Designated Bushfire Prone Area", so its stored point query —
  // which correctly returns no feature — looked like it contradicted the row.
  it.each([
    ['none-mapped-here', 'Designated Bushfire Prone Area — none mapped at this address'],
    ['not-published', 'Designated Bushfire Prone Area — not published for this area'],
  ] as const)('names a stored %s layer row by its status, never as a designation', (status, name) => {
    const content: CompletePackContent = {
      pack: pack(),
      layers: [{ ...layer, status }],
      destinations: [], recovery: [], recoveryVerified: true,
    };
    expect(packDetailItems(content).map((item) => item.name)).toEqual([name]);
  });

  it('names a stored present layer row by the designation alone', () => {
    const content: CompletePackContent = {
      pack: pack(),
      layers: [layer],
      destinations: [], recovery: [], recoveryVerified: true,
    };
    expect(packDetailItems(content).map((item) => item.name)).toEqual([
      copy.DESIGNATED_BUSHFIRE_PRONE_AREA,
    ]);
  });

  it('does not invent a basemap item when its attribution source is absent', () => {
    const content: CompletePackContent = {
      pack: pack({ builtWithTiles: true }),
      layers: [], destinations: [], recovery: [], recoveryVerified: true,
    };
    expect(packDetailItems(content)).toEqual([]);
  });
});

describe('E2-US1-AC3 stored absence row', () => {
  const withAbsence = (): CompletePackContent => ({
    pack: pack(),
    layers: [],
    destinations: [absenceRow('pack-1', 'Yarra Ranges', source())],
    recovery: [],
    recoveryVerified: true,
  });

  it('is never projected as an information item — it has no content to open', () => {
    const content = withAbsence();
    content.destinations.unshift(destination());
    expect(packDetailItems(content).map(({ id }) => id)).toEqual(['pack-1:nsp-0001']);
  });

  it('a present destination with no name of its own still gets the neutral label', () => {
    const content: CompletePackContent = {
      pack: pack(),
      layers: [],
      destinations: [destination({ id: 'pack-1:x', name: undefined })],
      recovery: [],
      recoveryVerified: true,
    };
    expect(packDetailItems(content).map(({ name }) => name)).toEqual([
      'Official place of last resort information',
    ]);
  });

  it('packDetailAbsence returns its stored reason, verbatim', () => {
    expect(packDetailAbsence(withAbsence())).toBe(
      'No official place of last resort is published for this area — Yarra Ranges.',
    );
  });

  it('packDetailAbsence returns null when every destination is a present place', () => {
    expect(
      packDetailAbsence({
        pack: pack(),
        layers: [],
        destinations: [destination()],
        recovery: [],
        recoveryVerified: true,
      }),
    ).toBeNull();
  });

  it('packDetailAbsence returns null for an absence row that carries no reason', () => {
    expect(
      packDetailAbsence({
        pack: pack(),
        layers: [],
        destinations: [destination({ id: 'pack-1:absence', kind: 'absence', name: undefined })],
        recovery: [],
        recoveryVerified: true,
      }),
    ).toBeNull();
  });
});
