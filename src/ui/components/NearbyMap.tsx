import { useEffect, useState } from 'react';
import { mapAcrossKm, mapBoxAround } from '../../core/area-map-view';
import { AREA_MAP_HALF_KM, NEARBY_MAP_HALF_PX, ROADS_LOCALITY_PX } from '../../core/constants';
import * as copy from '../../core/copy';
import { decodeLocalities, type Locality } from '../../core/localities';
import { drawNearbyMap, type NearbyMapDrawing } from '../../core/nearby-map';
import { decodeRoads, type RoadMap } from '../../core/roads';
import type { Destination, LatLon } from '../../core/types';
import AreaMap from './AreaMap';
import { ROAD_KIND } from './BlackSkyDial';

export type MapLoaders = {
  loadRoads: () => Promise<ArrayBuffer | undefined>;
  loadLocalities: () => Promise<unknown>;
};

// Each file is read and decoded once per loader while the app runs. A file the
// phone does not hold, or cannot read, draws nothing, and is tried again the
// next time the map opens.
const heldRoads = new WeakMap<MapLoaders['loadRoads'], Promise<RoadMap | null>>();
const heldLocalities = new WeakMap<MapLoaders['loadLocalities'], Promise<Locality[]>>();
const NO_LOCALITIES: Locality[] = [];

function hold<L extends object, T>(cache: WeakMap<L, Promise<T>>, loader: L, read: () => Promise<T>, empty: T): Promise<T> {
  let held = cache.get(loader);
  if (!held) {
    held = read()
      .catch(() => empty)
      .then((value) => {
        if (value === empty) cache.delete(loader);
        return value;
      });
    cache.set(loader, held);
  }
  return held;
}

/** Nearby's map: the main roads and town names round where distances are
 *  measured from, drawn on the phone from files it already holds, with the
 *  nearest Neighbourhood Safer Places marked. Explored like a pack's map. */
export default function NearbyMap({
  origin,
  originName,
  places,
  loaders,
}: {
  origin: LatLon;
  originName: string;
  places: Pick<Destination, 'id' | 'name' | 'lat' | 'lon' | 'distanceM'>[];
  loaders: MapLoaders;
}) {
  const [drawing, setDrawing] = useState<{ at: LatLon; map: NearbyMapDrawing; hasRoads: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([
      hold(heldRoads, loaders.loadRoads, async () => {
        const bytes = await loaders.loadRoads();
        return bytes ? decodeRoads(bytes) : null;
      }, null),
      hold(heldLocalities, loaders.loadLocalities, async () => {
        const raw = await loaders.loadLocalities();
        return raw === undefined ? NO_LOCALITIES : decodeLocalities(raw);
      }, NO_LOCALITIES),
    ]).then(([roads, localities]) => {
      const marks = places.flatMap((place) => (place.lat === undefined || place.lon === undefined ? [] : [{ lat: place.lat, lon: place.lon }]));
      if (live) setDrawing({ at: origin, map: drawNearbyMap(roads, localities, origin, marks), hasRoads: roads !== null });
    });
    return () => {
      live = false;
    };
  }, [origin, loaders]);

  const box = mapBoxAround(origin, AREA_MAP_HALF_KM);
  const half = NEARBY_MAP_HALF_PX;
  // A drawing for an earlier origin is never shown under this one's marks.
  const shown = drawing?.at === origin ? drawing : null;
  const picture = (
    <svg className="nearby-map-picture" viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`} role="img" aria-label={copy.NEARBY_MAP_ALT}>
      <rect className="nearby-map-ground" x={-half} y={-half} width={2 * half} height={2 * half} />
      {shown?.map.roads.map((road, i) => (
        <path key={i} className={`blacksky-road ${ROAD_KIND[road.cls] ?? 'collector'} ${road.pass}`} d={road.d} strokeWidth={road.widthPx} />
      ))}
      {shown?.map.names.map((place) => (
        <text key={place.name} className="nearby-map-town" x={place.x} y={place.y} fontSize={ROADS_LOCALITY_PX}>
          {place.name}
        </text>
      ))}
    </svg>
  );
  return (
    <div className="nearby-map">
      <figure className="area-map">
        <AreaMap
          picture={picture}
          box={box}
          places={places}
          address=""
          hereTitle={originName}
          scale={copy.AREA_MAP_ACROSS(mapAcrossKm(box))}
        />
      </figure>
      {places.length === 0 ? <p className="muted place-note">{copy.NEARBY_MAP_NONE}</p> : null}
      {shown && !shown.hasRoads ? <p className="muted place-note">{copy.NEARBY_MAP_NO_ROADS}</p> : null}
    </div>
  );
}
