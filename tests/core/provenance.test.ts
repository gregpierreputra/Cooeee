import { describe, expect, it } from 'vitest';

import { DTP_DATASET_URL, MS_PER_DAY } from '../../src/core/constants';
import * as copy from '../../src/core/copy';
import { absenceRow } from '../../src/core/destination';
import {
  decideOriginalSourceAccess,
  formatSavedDate,
  hasCompleteSource,
  isAllowedSourceUrl,
  missingDisplayProvenance,
  formatGazettalDate,
  packDetailAbsence,
  packDetailItems,
  packDetailPlaces,
  prepareProvenancedContent,
  provenanceView,
  savedAgeDays,
  sourcePageUrls,
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

  // Vicmap writes a gazettal date as dd/mm/yyyy; it is read back the same way a
  // saved date is, and anything else is left exactly as the publisher wrote it.
  it('reads a gazettal date the same way it reads a saved date', () => {
    expect(formatGazettalDate('10/07/2025')).toBe('10 July 2025');
    expect(formatGazettalDate('01/01/2020')).toBe('1 January 2020');
    expect(formatGazettalDate('2025-07-10')).toBe('2025-07-10');
    expect(formatGazettalDate('')).toBe('');
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
    'https://discover.data.vic.gov.au/dataset/designated-bushfire-prone-area-bpa',
    'https://www.cfa.vic.gov.au/plan-prepare',
  ])('allows the reviewed HTTPS source %s', (url) => {
    expect(isAllowedSourceUrl(url)).toBe(true);
  });

  it.each([
    'http://servicesaustralia.gov.au/example',
    'https://vic.gov.au.attacker.example/',
    'https://evil.vic.gov.au/plan-prepare', // an unlisted subdomain of the apex
    'https://vic.gov.au/',
    'not a URL',
  ])('rejects an unreviewed or non-HTTPS source %s', (url) => {
    expect(isAllowedSourceUrl(url)).toBe(false);
  });
});

describe('source pages carried as PDF copies', () => {
  it('lists the dataset page and each chosen place page once', () => {
    const cfa = 'https://www.cfa.vic.gov.au/plan-prepare/neighbourhood-safer-places';
    const content: TextPackContent = {
      pack: seed(),
      layers: [layer],
      destinations: [
        destination({ id: 'pack-1:a', source: source({ url: cfa }) }),
        destination({ id: 'pack-1:b', source: source({ url: cfa }) }),
        absenceRow('pack-1', 'Yarra Ranges', source()),
      ],
      recovery: [],
    };
    expect(sourcePageUrls(content)).toEqual([DTP_DATASET_URL, cfa]);
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
      files: [], notes: [], recoveryVerified: true, contentVerified: true,
    };

    expect(packDetailItems(content).map(({ name }) => name)).toEqual([
      'Designated Bushfire Prone Area',
      'Example payment',
      'Offline basemap',
    ]);
  });

  // The reported defect: a pack whose stored BPA status was an absence still
  // rendered as "Designated Bushfire Prone Area", so its stored point query —
  // which correctly returns no feature — looked like it contradicted the row.
  it.each([
    ['none-mapped-here', 'Designated Bushfire Prone Area, none mapped at this address'],
    ['not-published', 'Designated Bushfire Prone Area, not published for this area'],
  ] as const)('names a stored %s layer row by its status, never as a designation', (status, name) => {
    const content: CompletePackContent = {
      pack: pack(),
      layers: [{ ...layer, status }],
      destinations: [], recovery: [], files: [], notes: [], recoveryVerified: true, contentVerified: true,
    };
    expect(packDetailItems(content).map((item) => item.name)).toEqual([name]);
  });

  it('names a stored present layer row by the designation alone', () => {
    const content: CompletePackContent = {
      pack: pack(),
      layers: [layer],
      destinations: [], recovery: [], files: [], notes: [], recoveryVerified: true, contentVerified: true,
    };
    expect(packDetailItems(content).map((item) => item.name)).toEqual([
      copy.DESIGNATED_BUSHFIRE_PRONE_AREA,
    ]);
  });

  // "Open original source (web)" used to be the only way to see what had been
  // checked, and it leads to a raw GeoServer response. The stored plan is the
  // same fact in words, so it travels with the item.
  it('cites the gazetted plan a present BPA row stored, dated for reading', () => {
    const content: CompletePackContent = {
      pack: pack(),
      layers: [{
        ...layer,
        features: [{ planNumber: 'LEGL./25-138', gazettalDate: '10/07/2025' }],
      }],
      destinations: [], recovery: [], files: [], notes: [], recoveryVerified: true, contentVerified: true,
    };
    expect(packDetailItems(content).map(({ citation }) => citation)).toEqual([
      'Bushfire Prone Area plan LEGL./25-138 · gazetted 10 July 2025 · YARRA RANGES'
      + ' · Department of Transport and Planning',
    ]);
  });

  it.each([
    ['a row with no stored plan', { ...layer }],
    ['a plan with no gazettal date', { ...layer, features: [{ planNumber: 'LEGL./25-138' }] }],
    ['an absence that stored no feature', { ...layer, status: 'none-mapped-here' as const }],
  ])('cites nothing for %s', (_case, row) => {
    const content: CompletePackContent = {
      pack: pack(),
      layers: [row],
      destinations: [],
      recovery: [], files: [], notes: [], recoveryVerified: true, contentVerified: true,
    };
    expect(packDetailItems(content).map(({ citation }) => citation)).toEqual([undefined]);
  });

  it('does not invent a basemap item when its attribution source is absent', () => {
    const content: CompletePackContent = {
      pack: pack({ builtWithTiles: true }),
      layers: [], destinations: [], recovery: [], files: [], notes: [], recoveryVerified: true, contentVerified: true,
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
    files: [], notes: [], recoveryVerified: true, contentVerified: true,
  });

  it('is never projected as an information item or a place — it has no content to open', () => {
    const content = withAbsence();
    content.destinations.unshift(destination());
    expect(packDetailItems(content)).toEqual([]);
    expect(packDetailPlaces(content).map(({ id }) => id)).toEqual(['pack-1:nsp-0001']);
  });

  it('packDetailPlaces restores the by-distance order the list was shown in', () => {
    const content: CompletePackContent = {
      pack: pack(),
      layers: [],
      destinations: [
        destination({ id: 'pack-1:b', distanceOrder: 1 }),
        destination({ id: 'pack-1:a', distanceOrder: 0 }),
      ],
      recovery: [],
      files: [], notes: [], recoveryVerified: true, contentVerified: true,
    };
    expect(packDetailPlaces(content).map(({ id }) => id)).toEqual(['pack-1:a', 'pack-1:b']);
  });

  it('packDetailAbsence returns its stored reason, verbatim', () => {
    expect(packDetailAbsence(withAbsence())).toBe(
      'No official place of last resort is published for this area, Yarra Ranges.',
    );
  });

  it('packDetailAbsence returns null when every destination is a present place', () => {
    expect(
      packDetailAbsence({
        pack: pack(),
        layers: [],
        destinations: [destination()],
        recovery: [],
        files: [], notes: [], recoveryVerified: true, contentVerified: true,
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
        files: [], notes: [], recoveryVerified: true, contentVerified: true,
      }),
    ).toBeNull();
  });
});
