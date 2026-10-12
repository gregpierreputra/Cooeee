import { useEffect, useState } from 'react';

import { areaResultLine } from '../core/area-check';
import { KM_PER_DEGREE_LAT, mapBoxOf, mapPoint, printMapHalfKm, type MapBox } from '../core/area-map-view';
import { siteInSentence, siteNameBlock } from '../core/blacksky-dial';
import { AREA_MAP_NAME, HOTLINE_NUMBER, TRIPLE_ZERO } from '../core/constants';
import * as copy from '../core/copy';
import { formatDistanceM, placeName } from '../core/destination';
import { shownPackName, titleCase } from '../core/home';
import { packIcon } from '../core/pack';
import { formatSavedDate, packDetailAbsence, packDetailItems, packDetailPlaces } from '../core/provenance';
import type { CompletePackContent, Destination, LatLon } from '../core/types';
import { getCompletePackContent } from '../data/db';
import Glyph from './components/Glyph';
import KeyTerms from './components/KeyTerms';
import NoteText from './components/NoteText';
import StatusPage from './components/StatusPage';

/** The pack on paper, for when the phone is flat: the place, its bushfire
 *  area answer as the Area tab gives it, the two chosen places, the notes and
 *  who to call on the first page, then a map of home and the places on the
 *  next. Everything is read from the phone, so it works with no signal. The
 *  page is shown first and prints only when the person taps Print; on paper
 *  the app's bars and the button are left off. */
export default function PackPrint({
  packId,
  loadContent = getCompletePackContent,
  now = Date.now(),
}: {
  packId: string;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  now?: number;
}) {
  // null = the store has not answered yet; undefined = no such pack here.
  const [content, setContent] = useState<CompletePackContent | null | undefined>(null);
  // The stored map's picture, made from the bytes on the phone, released with
  // the page. No request is involved.
  const [mapSrc, setMapSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    let live = true;
    let url: string | undefined;
    loadContent(packId).then(
      (value) => {
        if (!live) return;
        const map = value?.files.find((file) => file.name === AREA_MAP_NAME);
        url = map ? URL.createObjectURL(new Blob([map.bytes], { type: 'image/png' })) : undefined;
        setMapSrc(url);
        setContent(value);
      },
      () => {
        if (live) setContent(undefined);
      },
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [loadContent, packId]);

  if (content === null) return <main className="page" />;
  if (content === undefined) {
    return <StatusPage page="pack-print" kicker={copy.EYEBROW_MY_PACK} card={<p>{copy.PACK_NOT_FOUND}</p>} />;
  }

  const { pack } = content;
  const items = packDetailItems(content);
  const places = packDetailPlaces(content);
  const absence = packDetailAbsence(content);
  const programs = content.recovery.filter((program) => program.telephone);
  // The bushfire area answer, worded as the Area tab words it: only inside is
  // a match, and every other answer carries that fire can still reach you.
  const bpa = content.layers.find((row) => row.code === 'BPA');
  const mapFile = content.files.find((file) => file.name === AREA_MAP_NAME);
  const mapBox = mapFile ? mapBoxOf(mapFile.url) : null;

  return (
    <main className="page pack-print">
      <header className="hero">
        <span className="kicker">{copy.EYEBROW_MY_PACK}</span>
        <div className="card-head">
          <Glyph kind={packIcon(pack)} />
          <h1 className="pack-name">{shownPackName(pack.name)}</h1>
        </div>
        <p>{titleCase(pack.address)}</p>
        {/* When it was printed and from what, and whose instructions come
            first, at the top, so they are on the first sheet whatever the
            length of the notes. */}
        <p className="muted">{copy.PRINTED_FROM(formatSavedDate(now), formatSavedDate(pack.verifiedAt))}</p>
        <p className="print-first">{copy.OFFICIAL_INSTRUCTIONS_FIRST}</p>
      </header>

      {/* Anything the pack's own check withheld stays off the paper too. */}
      {!content.contentVerified ? <p className="print-withheld">{copy.PACK_ITEMS_UNVERIFIED}</p> : null}

      <section className="print-section">
        <h2 className="kicker">{copy.PRINT_AREA_TITLE}</h2>
        {absence ? <p>{absence}</p> : null}
        {items.map((item) => {
          const isBpa = item.id === bpa?.id;
          return (
            <div key={item.id} className="print-area">
              <p className="print-area-answer">{isBpa ? areaResultLine(bpa.status) : item.name}</p>
              {isBpa && bpa.status !== 'present' ? (
                <p><KeyTerms text={copy.AREA_MAP_IS_NOT_FIRE_REACH} /></p>
              ) : null}
              {item.citation ? <p className="muted print-source">{item.citation}</p> : null}
            </div>
          );
        })}
      </section>

      {/* The numbers, written out in full: on paper there is nothing to tap.
          Straight after the area answer, so they are always on the first page. */}
      <section className="print-section">
        <h2 className="kicker">{copy.WHO_TO_CALL}</h2>
        <ul className="print-list print-calls">
          <li className="emergency-line">
            <strong>{copy.TRIPLE_ZERO_LABEL}</strong>
            <span>{copy.TRIPLE_ZERO_DETAIL}</span>
            <span className="figure">{TRIPLE_ZERO}</span>
          </li>
          <li>
            <strong>{copy.HOTLINE_LABEL}</strong>
            <span className="figure">{HOTLINE_NUMBER}</span>
          </li>
          {programs.map((program) => (
            <li key={program.id}>
              <strong>{program.title}</strong>
              <span>{program.org}</span>
              <span className="figure">{program.telephone}</span>
            </li>
          ))}
        </ul>
      </section>

      {places.length > 0 ? (
        <section className="print-section">
          <h2 className="kicker">{copy.DESTINATIONS_STEP_TITLE}</h2>
          {/* As on the pack page: the kind said once, with how distance is
              measured, then each place as the site, where it is, and how far. */}
          <p className="muted">
            {copy.SAVED_PLACES_KIND(places.length)}
            {places.some((place) => typeof place.distanceM === 'number') ? ` ${copy.DISTANCES_NOTE}` : null}
          </p>
          <ul className="print-list">
            {places.map((place) => {
              const { site, line } = siteNameBlock(placeName(place));
              return (
                <li key={place.id}>
                  <strong>{site}</strong>
                  {/* Where it is and how far, on one line, to keep the page to one sheet. */}
                  <span>
                    {[line, place.addressText, typeof place.distanceM === 'number' ? formatDistanceM(place.distanceM) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {content.notes.length > 0 ? (
        <section className="print-section print-notes">
          <h2 className="kicker">{copy.NOTES}</h2>
          {content.notes.map((note) => (
            <div key={note.id} className="print-note">
              <NoteText text={note.text} />
            </div>
          ))}
        </section>
      ) : null}


      {/* On its own page after the essentials: home and the chosen places on
          the stored map, cut down so its road names print large enough. */}
      {mapSrc && mapBox ? (
        <PrintMap src={mapSrc} box={mapBox} centre={pack} places={places} />
      ) : null}

      <div className="actions print-actions">
        <button type="button" className="main-action with-glyph" onClick={() => window.print()}>
          <Glyph kind="print" line />
          {copy.PRINT_PACK}
        </button>
      </div>
    </main>
  );
}

/** The stored map cut down to home and its chosen places, with the marks and
 *  key the pack page uses, still and ready for paper. A chosen place past the
 *  stored map is named under it. */
function PrintMap({ src, box, centre, places }: { src: string; box: MapBox; centre: LatLon; places: Destination[] }) {
  const located = places.flatMap((place) => {
    if (place.lat === undefined || place.lon === undefined) return [];
    const at = mapPoint(box, { lat: place.lat, lon: place.lon });
    return at ? [{ place, at }] : [];
  });
  const off = places.filter((place) =>
    place.lat !== undefined && place.lon !== undefined && typeof place.distanceM === 'number'
      && !located.some((each) => each.place.id === place.id));
  const mapHalfKm = ((box.north - box.south) * KM_PER_DEGREE_LAT) / 2;
  const halfKm = printMapHalfKm(centre, located.map(({ place }) => ({ lat: place.lat!, lon: place.lon! })), mapHalfKm);
  // The share of the stored picture shown, and a point's place in the cut.
  const share = halfKm / mapHalfKm;
  const cut = (at: { x: number; y: number }) => ({ x: (at.x - 0.5) / share + 0.5, y: (at.y - 0.5) / share + 0.5 });
  const grow = 1 / share;
  return (
    <section className="print-section print-map">
      <h2 className="kicker">{copy.PRINT_MAP_TITLE}</h2>
      <figure>
        <div className="print-map-frame">
          <img
            src={src}
            alt={copy.AREA_MAP_ALT}
            style={{ width: `${grow * 100}%`, left: `${(1 - grow) * 50}%`, top: `${(1 - grow) * 50}%` }}
          />
          <span className="area-map-pin" aria-hidden="true" />
          {/* Each place a numbered disc, named in the list under the map: two
              places close together never cover each other's name. */}
          {located.map(({ place, at }, index) => {
            const spot = cut(at);
            return (
              <span
                key={place.id}
                className="print-map-mark"
                style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
                aria-hidden="true"
              >
                {index + 1}
              </span>
            );
          })}
          <span className="area-map-scale">{copy.AREA_MAP_ACROSS(halfKm * 2)}</span>
        </div>
        <figcaption>
          <ul className="map-key">
            <li><span className="map-key-icon" aria-hidden="true"><span className="swatch swatch-inside" /></span>{copy.AREA_MAP_KEY.inside}</li>
            <li><span className="map-key-icon" aria-hidden="true"><span className="swatch swatch-outside" /></span>{copy.AREA_MAP_KEY.outside}</li>
            <li><span className="map-key-icon" aria-hidden="true"><span className="swatch swatch-place" /></span>{copy.AREA_MAP_KEY.place}</li>
            <li><span className="map-key-icon" aria-hidden="true"><span className="print-map-mark print-map-mark-key">1</span></span>{copy.AREA_MAP_KEY.lastResort}</li>
          </ul>
          <ol className="print-map-places">
            {located.map(({ place }) => (
              <li key={place.id}>
                {siteNameBlock(placeName(place)).site}
                {typeof place.distanceM === 'number' ? <span className="muted"> · {formatDistanceM(place.distanceM)}</span> : null}
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>
      {off.map((place) => (
        <p key={place.id} className="muted">{copy.PLACE_OFF_MAP(siteInSentence(placeName(place)), formatDistanceM(place.distanceM!))}</p>
      ))}
    </section>
  );
}
