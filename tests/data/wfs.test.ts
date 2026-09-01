import { describe, expect, it } from 'vitest';

import {
  buildBushfireAreaAtPointUrl,
  buildBushfireAreaExistenceUrl,
  buildLgaAtPointUrl,
  buildAddressSearchUrl,
  fetchAddressCandidates,
  fetchBushfireAreaResult,
  parseAddressFeature,
  parseLgaName,
} from '../../src/data/wfs';
import type { PendingPlace } from '../../src/core/types';

function feature(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    bbox: [-37.817939, 145.36594, -37.817939, 145.36594],
    geometry: { type: 'Point', coordinates: [145.36594, -37.817939] },
    properties: {
      ezi_address: '6 RIDGE ROAD KALORAMA 3766',
      locality_name: 'KALORAMA',
      property_status: 'A',
      is_primary: 'Y',
    },
    ...overrides,
  };
}

describe('parseAddressFeature', () => {
  it('reads longitude then latitude from Point geometry and ignores bbox', () => {
    expect(parseAddressFeature(feature())).toEqual({
      address: '6 RIDGE ROAD KALORAMA 3766',
      localityName: 'KALORAMA',
      lat: -37.817939,
      lon: 145.36594,
    });
  });

  it('preserves source strings exactly', () => {
    const result = parseAddressFeature(feature({
      properties: { ezi_address: ' 6 RIDGE ROAD ', locality_name: ' KALORAMA ' },
    }));
    expect(result.address).toBe(' 6 RIDGE ROAD ');
    expect(result.localityName).toBe(' KALORAMA ');
  });

  it.each([
    ['missing geometry', feature({ geometry: null })],
    ['non-Point geometry', feature({ geometry: { type: 'LineString', coordinates: [] } })],
    ['missing coordinates', feature({ geometry: { type: 'Point' } })],
    ['non-finite longitude', feature({ geometry: { type: 'Point', coordinates: [NaN, -37] } })],
    ['missing properties', feature({ properties: null })],
    ['missing address', feature({ properties: { locality_name: 'KALORAMA' } })],
    ['missing locality', feature({ properties: { ezi_address: '6 RIDGE ROAD' } })],
  ])('rejects %s', (_label, value) => {
    expect(() => parseAddressFeature(value)).toThrow(TypeError);
  });
});

describe('address search request', () => {
  it('uses the official WFS, caps results and keeps geometry in the response', () => {
    const url = new URL(buildAddressSearchUrl("o'connor"));
    expect(url.origin + url.pathname).toBe('https://opendata.maps.vic.gov.au/geoserver/wfs');
    expect(url.searchParams.get('count')).toBe('10');
    expect(url.searchParams.get('CQL_FILTER')).toBe(
      "property_status = 'A' AND ezi_address LIKE 'O''CONNOR%'",
    );
    expect(url.searchParams.has('propertyName')).toBe(false);
  });

  it('parses, filters and returns candidates from a successful response', async () => {
    const inactive = feature({
      properties: {
        ezi_address: 'RETIRED ADDRESS', locality_name: 'OLD',
        property_status: 'R', is_primary: 'Y',
      },
    });
    const fetcher = async () => new Response(JSON.stringify({
      type: 'FeatureCollection', features: [feature(), inactive],
    }), { status: 200 });

    await expect(fetchAddressCandidates('ridge', fetcher)).resolves.toEqual({
      candidates: [{
        address: '6 RIDGE ROAD KALORAMA 3766',
        localityName: 'KALORAMA',
        lat: -37.817939,
        lon: 145.36594,
      }],
      unresolvedCount: 0,
      returnedCount: 2,
    });
  });

  it('returns an empty list only for a valid empty feature collection', async () => {
    const fetcher = async () => new Response(JSON.stringify({ features: [] }), { status: 200 });
    await expect(fetchAddressCandidates('unknown', fetcher))
      .resolves.toEqual({ candidates: [], unresolvedCount: 0, returnedCount: 0 });
  });

  // The search runs while the user types, so the caller supersedes its own
  // requests. Cancellation has to reach the wire, not merely discard a reply
  // that the device still paid for and still sent the typed prefix to obtain.
  it('passes the caller cancellation through to the request', async () => {
    const caller = new AbortController();
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
      caller.abort();
      expect(init?.signal?.aborted).toBe(true);
      throw new DOMException('The operation was aborted.', 'AbortError');
    };

    await expect(fetchAddressCandidates('ridge', fetcher, () => undefined, caller.signal))
      .rejects.toThrow('aborted');
  });

  it('never issues a request for a query the caller has already cancelled', async () => {
    const caller = new AbortController();
    caller.abort();
    let signalled: AbortSignal | undefined;
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
      signalled = init?.signal ?? undefined;
      throw new DOMException('The operation was aborted.', 'AbortError');
    };

    await expect(fetchAddressCandidates('ridge', fetcher, () => undefined, caller.signal))
      .rejects.toThrow('aborted');
    expect(signalled?.aborted).toBe(true);
  });

  it('rejects service failures instead of mapping them to no-match', async () => {
    const fetcher = async () => new Response('', { status: 503 });
    await expect(fetchAddressCandidates('ridge', fetcher)).rejects.toThrow('HTTP 503');
  });

  it('rejects a drifted feature-collection shape', async () => {
    const fetcher = async () => new Response(JSON.stringify({ features: null }), { status: 200 });
    await expect(fetchAddressCandidates('ridge', fetcher)).rejects.toThrow(TypeError);
  });
});

describe('E1-US1-AC2 duplicate resolution at the data boundary', () => {
  const duplicateAt = (lon: number, lat: number, isPrimary = 'N') => feature({
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      ezi_address: '6 RIDGE ROAD KALORAMA 3766',
      locality_name: 'KALORAMA',
      property_status: 'A',
      is_primary: isPrimary,
    },
  });
  const collection = (features: unknown[]) => async () =>
    new Response(JSON.stringify({ type: 'FeatureCollection', features }), { status: 200 });

  it('collapses a repeated address that the service returned at one point', async () => {
    const resolution = await fetchAddressCandidates(
      'ridge',
      collection([duplicateAt(145.36594, -37.817939), duplicateAt(145.36594, -37.817939, 'Y')]),
    );
    expect(resolution.candidates).toHaveLength(1);
    expect(resolution.unresolvedCount).toBe(0);
  });

  it('withholds a repeated address the service returned at conflicting points', async () => {
    const resolution = await fetchAddressCandidates(
      'ridge',
      collection([duplicateAt(145.36594, -37.817939), duplicateAt(145.365951, -37.817944)]),
      () => undefined,
    );
    expect(resolution).toEqual({ candidates: [], unresolvedCount: 1, returnedCount: 2 });
  });

  it('reports the unresolved condition as a bare count, naming no address or point', async () => {
    const reported: string[] = [];
    await fetchAddressCandidates(
      'ridge',
      collection([duplicateAt(145.36594, -37.817939), duplicateAt(145.365951, -37.817944)]),
      (message) => reported.push(message),
    );
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('1');
    expect(reported[0]).not.toMatch(/RIDGE|KALORAMA|145\.|-37\.|pfi/i);
  });

  it('stays silent when every group resolved', async () => {
    const reported: string[] = [];
    await fetchAddressCandidates(
      'ridge',
      collection([duplicateAt(145.36594, -37.817939)]),
      (message) => reported.push(message),
    );
    expect(reported).toEqual([]);
  });

  it('keeps distinct unit addresses returned at one shared point', async () => {
    const unit = (address: string) => feature({
      properties: {
        ezi_address: address, locality_name: 'KALORAMA',
        property_status: 'A', is_primary: 'Y',
      },
    });
    const resolution = await fetchAddressCandidates('ridge', collection([
      unit('1/6 RIDGE ROAD KALORAMA 3766'),
      unit('2/6 RIDGE ROAD KALORAMA 3766'),
      unit('6 RIDGE ROAD KALORAMA 3766'),
    ]));
    expect(resolution.candidates.map(({ address }) => address)).toEqual([
      '1/6 RIDGE ROAD KALORAMA 3766',
      '2/6 RIDGE ROAD KALORAMA 3766',
      '6 RIDGE ROAD KALORAMA 3766',
    ]);
  });
});

const pendingPlace: PendingPlace = {
  name: 'KALORAMA',
  address: '6 RIDGE ROAD KALORAMA 3766',
  lat: -37.817939,
  lon: 145.36594,
};

function featureCollection(features: unknown[]) {
  return { type: 'FeatureCollection', features };
}

function propertiesFeature(properties: Record<string, unknown>) {
  return { type: 'Feature', properties };
}

function areaFetcher(options: {
  pointHits: number;
  liveExists?: boolean;
  snapshotPublishedIn?: string[];
  lgaName?: string;
}) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/data/index.json') {
      return Response.json({ layerExtent: { file: 'layer-extent.v2026-08-28.json' } });
    }
    if (url === '/data/layer-extent.v2026-08-28.json') {
      return Response.json({
        layers: { BPA: { publishedIn: options.snapshotPublishedIn ?? ['YARRA RANGES'] } },
      });
    }
    const parsed = new URL(url);
    const type = parsed.searchParams.get('typeNames');
    const filter = parsed.searchParams.get('CQL_FILTER') ?? '';
    if (type === 'open-data-platform:lga_polygon') {
      return Response.json(featureCollection([
        propertiesFeature({ lga_name: options.lgaName ?? 'YARRA RANGES' }),
      ]));
    }
    if (filter.startsWith('INTERSECTS')) {
      return Response.json(featureCollection(
        options.pointHits > 0 ? [propertiesFeature({
          lga_name: 'YARRA RANGES',
          plan_number: 'LEGL./25-138',
          gazettal_date: '10/07/2025',
        })] : [],
      ));
    }
    return Response.json(featureCollection(
      options.liveExists === false ? [] : [propertiesFeature({ lga_name: 'YARRA RANGES' })],
    ));
  };
}

describe('bushfire-area request', () => {
  it('uses latitude then longitude and never requests polygon geometry', () => {
    for (const urlText of [buildLgaAtPointUrl(pendingPlace), buildBushfireAreaAtPointUrl(pendingPlace)]) {
      const url = new URL(urlText);
      expect(url.searchParams.get('CQL_FILTER')).toContain('POINT(-37.817939 145.36594)');
      expect(url.searchParams.get('propertyName')).toBeTruthy();
    }
    expect(new URL(buildBushfireAreaAtPointUrl(pendingPlace)).searchParams.get('propertyName'))
      .toBe('lga_name,plan_number,gazettal_date');
  });

  // Verified against the live GeoServer on 2026-09-02: POINT(lat lon) returns
  // the designation feature for this address on both layers, and POINT(lon lat)
  // returns nothing. A "corrected" swap would silently turn every point hit into
  // an absence, so the axis order is pinned here rather than left to a comment.
  it('keeps the axis order the live layers accept, never longitude first', () => {
    for (const urlText of [buildLgaAtPointUrl(pendingPlace), buildBushfireAreaAtPointUrl(pendingPlace)]) {
      const filter = new URL(urlText).searchParams.get('CQL_FILTER') ?? '';
      expect(filter).toContain(`POINT(${pendingPlace.lat} ${pendingPlace.lon})`);
      expect(filter).not.toContain(`POINT(${pendingPlace.lon} ${pendingPlace.lat})`);
    }
  });

  it('escapes the LGA name in the existence probe', () => {
    expect(new URL(buildBushfireAreaExistenceUrl("O'CONNOR")).searchParams.get('CQL_FILTER'))
      .toBe("lga_name='O''CONNOR'");
  });

  it('asserts the LGA response shape', () => {
    expect(parseLgaName(featureCollection([propertiesFeature({ lga_name: 'YARRA RANGES' })])))
      .toBe('YARRA RANGES');
    expect(() => parseLgaName(featureCollection([]))).toThrow('exactly one');
    expect(() => parseLgaName(featureCollection([propertiesFeature({})]))).toThrow('lga_name');
  });

  it('returns present without an absence probe', async () => {
    const requests: string[] = [];
    const base = areaFetcher({ pointHits: 1 });
    const fetcher = async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return base(input);
    };
    const result = await fetchBushfireAreaResult(pendingPlace, fetcher, () => 123);
    expect(result.status).toBe('present');
    // The hit's own plan and gazettal date, kept rather than validated and
    // dropped: they are what the pack can cite without a network.
    expect(result).toMatchObject({
      planNumber: 'LEGL./25-138',
      gazettalDate: '10/07/2025',
    });
    expect(result.source).toMatchObject({
      publisher: 'Department of Transport and Planning', licence: 'CC BY 4.0', retrievedAt: 123,
    });
    expect(requests.some((url) => url.includes("lga_name%3D"))).toBe(false);
    // A present result is only ever a direct point hit, so the URL it cites has
    // to be that hit's own query — never a query that returned nothing.
    expect(result.source.url).toBe(buildBushfireAreaAtPointUrl(pendingPlace));
  });

  it('carries no plan or gazettal date when nothing was matched', async () => {
    const result = await fetchBushfireAreaResult(
      pendingPlace,
      areaFetcher({ pointHits: 0, liveExists: true }),
      () => 123,
    );
    expect(result.status).toBe('none-mapped-here');
    expect(result.planNumber).toBeUndefined();
    expect(result.gazettalDate).toBeUndefined();
  });

  it('distinguishes mapped absence from unpublished coverage using the live probe', async () => {
    await expect(fetchBushfireAreaResult(
      pendingPlace,
      areaFetcher({ pointHits: 0, liveExists: true }),
      () => 123,
    )).resolves.toMatchObject({ status: 'none-mapped-here', snapshotDisagreed: false });
    await expect(fetchBushfireAreaResult(
      pendingPlace,
      areaFetcher({
        pointHits: 0,
        liveExists: false,
        snapshotPublishedIn: [],
        lgaName: 'MELBOURNE',
      }),
      () => 123,
    )).resolves.toMatchObject({ status: 'not-published', snapshotDisagreed: false });
  });

  it('prefers the live probe and raises a defect signal on snapshot drift', async () => {
    const defects: string[] = [];
    const result = await fetchBushfireAreaResult(
      pendingPlace,
      areaFetcher({ pointHits: 0, liveExists: false, snapshotPublishedIn: ['YARRA RANGES'] }),
      () => 123,
      (message) => defects.push(message),
    );
    expect(result).toMatchObject({ status: 'not-published', snapshotDisagreed: true });
    expect(defects).toEqual(['BPA extent snapshot disagrees with live probe for YARRA RANGES']);
  });

  it('rejects a failed request so the UI can show AC7 without storing a value', async () => {
    const fetcher = async () => new Response('', { status: 503 });
    await expect(fetchBushfireAreaResult(pendingPlace, fetcher)).rejects.toThrow('HTTP 503');
  });

  it('rejects drift in a positive bushfire-area feature', async () => {
    const base = areaFetcher({ pointHits: 1 });
    const fetcher = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('typeNames') === 'open-data-platform:bushfire_prone_area') {
        return Response.json(featureCollection([propertiesFeature({ lga_name: 'YARRA RANGES' })]));
      }
      return base(input);
    };
    await expect(fetchBushfireAreaResult(pendingPlace, fetcher)).rejects.toThrow('plan_number');
  });
});