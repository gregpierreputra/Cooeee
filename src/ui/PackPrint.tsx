import { useEffect, useState } from 'react';

import { HOTLINE_NUMBER, TRIPLE_ZERO } from '../core/constants';
import * as copy from '../core/copy';
import { formatDistanceM, placeName } from '../core/destination';
import { shownPackName, titleCase } from '../core/home';
import { packIcon } from '../core/pack';
import { formatSavedDate, packDetailAbsence, packDetailItems, packDetailPlaces } from '../core/provenance';
import type { CompletePackContent } from '../core/types';
import { getCompletePackContent } from '../data/db';
import Glyph from './components/Glyph';
import NoteText from './components/NoteText';
import StatusPage from './components/StatusPage';

/** One page of the pack on paper, for when the phone is flat: the place, its
 *  bushfire area answer, the two chosen places, the notes and who to call.
 *  Everything is read from the phone, so it works with no signal. The page is
 *  shown first and prints only when the person taps Print; on paper the app's
 *  bars and the button are left off. */
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

  useEffect(() => {
    let live = true;
    loadContent(packId).then(
      (value) => {
        if (live) setContent(value);
      },
      () => {
        if (live) setContent(undefined);
      },
    );
    return () => {
      live = false;
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

  return (
    <main className="page pack-print">
      <header className="hero">
        <span className="kicker">{copy.EYEBROW_MY_PACK}</span>
        <div className="card-head">
          <Glyph kind={packIcon(pack)} />
          <h1 className="pack-name">{shownPackName(pack.name)}</h1>
        </div>
        <p>{titleCase(pack.address)}</p>
        <p className="muted">{copy.PRINT_SAVED_ON(formatSavedDate(pack.verifiedAt))}</p>
      </header>

      {/* Anything the pack's own check withheld stays off the paper too. */}
      {!content.contentVerified ? <p className="print-withheld">{copy.PACK_ITEMS_UNVERIFIED}</p> : null}

      <section className="print-section">
        <h2 className="kicker">{copy.PRINT_AREA_TITLE}</h2>
        {absence ? <p>{absence}</p> : null}
        {items.map((item) => (
          <p key={item.id}>{item.name}</p>
        ))}
      </section>

      {places.length > 0 ? (
        <section className="print-section">
          <h2 className="kicker">{copy.DESTINATIONS_STEP_TITLE}</h2>
          {places.some((place) => typeof place.distanceM === 'number') ? (
            <p className="muted">{copy.DISTANCES_NOTE}</p>
          ) : null}
          <ul className="print-list">
            {places.map((place) => (
              <li key={place.id}>
                <strong>{placeName(place)}</strong>
                {place.addressText ? <span>{place.addressText}</span> : null}
                {typeof place.distanceM === 'number' ? <span>{formatDistanceM(place.distanceM)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.notes.length > 0 ? (
        <section className="print-section">
          <h2 className="kicker">{copy.NOTES}</h2>
          {content.notes.map((note) => (
            <div key={note.id} className="print-note">
              <NoteText text={note.text} />
            </div>
          ))}
        </section>
      ) : null}

      {/* The numbers, written out in full: on paper there is nothing to tap. */}
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

      <footer className="print-footer">
        <p>{copy.OFFICIAL_INSTRUCTIONS_FIRST}</p>
        <p className="muted">{copy.PRINTED_FROM(formatSavedDate(now), formatSavedDate(pack.verifiedAt))}</p>
      </footer>

      <div className="actions print-actions">
        <button type="button" className="main-action with-glyph" onClick={() => window.print()}>
          <Glyph kind="print" line />
          {copy.PRINT_PACK}
        </button>
      </div>
    </main>
  );
}
