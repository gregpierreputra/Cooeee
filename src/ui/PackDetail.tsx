import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';

import { mapAcrossKm, mapBoxOf } from '../core/area-map-view';
import { AREA_MAP_NAME, DTP_DATASET_URL } from '../core/constants';
import * as copy from '../core/copy';
import { formatDistanceM, placeName } from '../core/destination';
import {
  decideOriginalSourceAccess,
  formatSavedDate,
  packDetailAbsence,
  packDetailItems,
  packDetailPlaces,
} from '../core/provenance';
import { monogram } from '../core/recover';
import { drillRows, type DrillRow } from '../core/drill-history';
import { historyRows, type HistoryRow } from '../core/rehearsal-history';
import type { CompletePackContent, Drill, PackDetailItem, PackFile, Rehearsal } from '../core/types';
import { getCompletePackContent, listDrills, listRehearsalsForPack } from '../data/db';
import AreaMap from './components/AreaMap';
import Glyph from './components/Glyph';
import InfoGlyph from './components/InfoGlyph';
import KeyTerms from './components/KeyTerms';
import ProvenanceLine from './components/ProvenanceLine';
import Section from './components/Section';
import WellbeingLines from './components/WellbeingLines';
import StateCard from './components/StateCard';
import StatusPage from './components/StatusPage';
import { useRevealedPanel } from './components/useRevealedPanel';
import { PlaceFacts } from './PackNew/Destinations';
import { PackNotes } from './PackNotes';

type PackDetailProps = {
  packId: string;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  loadRehearsals?: (id: string) => Promise<Rehearsal[]>;
  loadDrills?: (id: string) => Promise<Drill[]>;
  now?: number;
};

/** A network-blind pack view. Every value comes from the complete-pack store;
 * every source tap is intercepted before browser navigation and requires a
 * second explicit choice before leaving Cooeee. */
export default function PackDetail({
  packId,
  loadContent = getCompletePackContent,
  loadRehearsals = listRehearsalsForPack,
  loadDrills = listDrills,
  now = Date.now(),
}: PackDetailProps) {
  const [content, setContent] = useState<CompletePackContent | null | undefined>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [drills, setDrills] = useState<DrillRow[]>([]);
  const [offlineSource, setOfflineSource] = useState<PackDetailItem | null>(null);
  // One object URL per stored file (the PDF copies and the area map), made
  // from the bytes already on the device and released with the screen. No
  // request is involved.
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    let urls: Record<string, string> = {};
    loadContent(packId).then((value) => {
      if (!live) return;
      urls = Object.fromEntries((value?.files ?? []).map((file) => [
        file.id,
        URL.createObjectURL(new Blob([file.bytes], { type: mediaType(file.name) })),
      ]));
      // Both land in the one render, so the file links are never a frame late.
      setFileUrls(urls);
      setContent(value);
    }, () => {
      // A store that cannot be read is a pack that is not available here, which
      // the screen already says. Left unhandled it would stay blank for good.
      if (live) setContent(undefined);
    });
    return () => {
      live = false;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [loadContent, packId]);

  // E5-US5 — the pack's own rehearsals, from the device store. A store that
  // cannot be read lists none: the section says so rather than failing the page.
  useEffect(() => {
    let live = true;
    loadRehearsals(packId).then(
      (rows) => {
        if (live) setHistory(historyRows(rows));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [loadRehearsals, packId]);

  // E9 — the pack's own drills, read the same way.
  useEffect(() => {
    let live = true;
    loadDrills(packId).then(
      (rows) => {
        if (live) setDrills(drillRows(rows));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [loadDrills, packId]);

  // The sheet takes focus while it is open, Escape closes it, and closing it
  // hands focus back to the link that opened it.
  useEffect(() => {
    if (!offlineSource) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOfflineSource(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [offlineSource]);

  // The page itself, empty, while the store answers: the route's focus lands on
  // it, and the same element carries the pack once it arrives.
  if (content === null) return <main className="page" />;
  if (content === undefined) {
    return (
      <StatusPage
        page="pack-detail"
        kicker={copy.EYEBROW_MY_PACK}
        card={<p>{copy.PACK_NOT_FOUND}</p>}
      />
    );
  }

  const items = packDetailItems(content);
  const places = packDetailPlaces(content);
  const absence = packDetailAbsence(content);
  const areaMap = content.files.find((file) => file.name === AREA_MAP_NAME);
  // The box the stored map was drawn for, read from its own request.
  const mapBox = areaMap ? mapBoxOf(areaMap.url) : null;
  const interceptSource = (event: MouseEvent<HTMLAnchorElement>, item: PackDetailItem) => {
    event.preventDefault();
    setOfflineSource(decideOriginalSourceAccess(item).item);
  };
  const sourceLinks = (item: PackDetailItem) => {
    const file = content.files.find((stored) => stored.url === (item.pageUrl ?? DTP_DATASET_URL));
    return (
      <SourceLinks item={item} file={file} href={file && fileUrls[file.id]} onWeb={interceptSource} />
    );
  };

  return (
    <main className="page pack-detail">
      <header className="hero">
        <span className="kicker">{copy.EYEBROW_MY_PACK}</span>
        <div className="card-head">
          <Glyph kind="place" />
          <h1>{content.pack.name}</h1>
        </div>
        <p className="muted">{content.pack.address}</p>
      </header>

      {/* The map of the pack's own area, from the bytes stored with the pack,
          to pan, zoom and turn. Absent on packs built before the map was stored. */}
      {areaMap && fileUrls[areaMap.id] ? (
        <Section kind="map" title={copy.AREA_MAP_LABEL}>
          <figure className="area-map">
            <AreaMap src={fileUrls[areaMap.id]} box={mapBox} places={places} />
            <figcaption className="muted">
              <ul className="map-key">
                <li><span className="swatch swatch-inside" aria-hidden="true" />{copy.AREA_MAP_KEY.inside}</li>
                <li><span className="swatch swatch-outside" aria-hidden="true" />{copy.AREA_MAP_KEY.outside}</li>
                <li><span className="swatch swatch-place" aria-hidden="true" />{copy.AREA_MAP_KEY.place}</li>
                <li><span className="area-map-mark-key" aria-hidden="true"><Glyph kind="place" size={14} /></span>{copy.AREA_MAP_KEY.lastResort}</li>
                {mapBox ? <li>{copy.AREA_MAP_ACROSS(mapAcrossKm(mapBox))}</li> : null}
              </ul>
              <p>{copy.AREA_MAP_SOURCE(formatSavedDate(areaMap.retrievedAt))}</p>
            </figcaption>
          </figure>
        </Section>
      ) : null}

      {!content.recoveryVerified ? (
        <StateCard heading={copy.RECOVERY_ITEMS_UNVERIFIED} />
      ) : null}
      {!content.contentVerified ? (
        <StateCard heading={copy.PACK_ITEMS_UNVERIFIED} />
      ) : null}

      {/* A stored absence row: its own plain statement, never an item in the
          list and never a source to open. */}
      {absence ? <StateCard heading={absence} /> : null}

      {items.length > 0 ? (
        <Section kind="layer" title={copy.STORED_INFORMATION} count={items.length}>
          <ul className="list pack-item-list">
            {items.map((item) => (
              <li key={item.id} className="card provenance-item">
                <h2>{item.name}</h2>
                <ProvenanceLine source={item.source} now={now} />
                {sourceLinks(item)}
              </li>
            ))}
          </ul>
        </Section>
      ) : absence || places.length > 0 ? null : (
        <StateCard heading={copy.NO_STORED_ITEMS} />
      )}

      {/* E2-US2: the two places the user chose, side by side with equal weight.
          Distance is a fact about each; there is no ordinal and no ranking. */}
      {places.length > 0 ? (
        <Section kind="place" title={copy.DESTINATIONS_STEP_TITLE} count={places.length}>
          {places.some((place) => typeof place.distanceM === 'number') ? (
            <p className="muted"><KeyTerms text={copy.DISTANCES_NOTE} /></p>
          ) : null}
          <ul className="list saved-destinations">
            {places.map((place) => {
              const item = {
                id: place.id,
                name: placeName(place),
                source: place.source,
                pageUrl: place.source.url,
              };
              return (
                <li key={place.id} className="card provenance-item">
                  <h2>{item.name}</h2>
                  {typeof place.distanceM === 'number' ? (
                    <p className="figure with-glyph place-distance">
                      <Glyph kind="go" line />
                      {formatDistanceM(place.distanceM)}
                    </p>
                  ) : null}
                  <PlaceFacts place={place} now={now} />
                  {sourceLinks(item)}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {/* E4-US7: the programs kept when the pack was built, each with the copy
          of its own page. One control opens and closes the whole section, so
          the pack's other items stay uncluttered. */}
      <Section kind="kept" title={copy.SAVED_PROGRAMS} count={content.recovery.length} defaultOpen={false}>
        {content.recovery.length === 0 ? (
          <p className="muted">{copy.NO_SAVED_PROGRAMS} <Link to="/recover">{copy.NAV_RECOVER}</Link></p>
        ) : (
          <ul className="list saved-programs">
            {content.recovery.map((program) => (
              <li key={program.id} className="card provenance-item">
                <div className="card-head">
                  <span className="monogram" aria-hidden="true">{monogram(program.org)}</span>
                  <div>
                    <h2>{program.title}</h2>
                    <p>{program.org}</p>
                  </div>
                </div>
                <ul className="need-pills">
                  {program.needs.map((need) => (
                    <li key={need} className="need-pill">
                      <Glyph kind={need} />
                      {copy.NEED_PHRASE[need]}
                    </li>
                  ))}
                </ul>
                <ProvenanceLine source={program.source} now={now} />
                {sourceLinks({ id: program.id, name: program.title, source: program.source, pageUrl: program.officialUrl })}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* R3: the wellbeing lines travel with every pack. */}
      <Section kind="calls" title={copy.TALK_TO_SOMEONE} defaultOpen={false}>
        <p className="muted">{copy.TALK_TO_SOMEONE_LINE}</p>
        <WellbeingLines />
      </Section>

      <Section kind="note" title={copy.NOTES}>
        <PackNotes packId={content.pack.id} notes={content.notes} />
      </Section>

      {/* E5-US5 — every rehearsal of this pack, newest first, in the result's
          own words. Closed by default: it is a record, not the next step. */}
      <Section kind="rehearse" title={copy.REHEARSALS} count={history.length} defaultOpen={false}>
        {history.length === 0 ? (
          <p>{copy.NOT_YET_REHEARSED}</p>
        ) : (
          <ul className="list history-list">
            {history.map((row) => (
              <li key={row.id} className="card history-row">
                <p className="history-date">{row.date}</p>
                <p className="muted">{row.condition}</p>
                <p>{row.ending}</p>
                <HistoryGaps id={row.id} gaps={row.gaps} found={row.found} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* E9 — every drill of this pack, newest first. A record, like the
          rehearsals above it, so it too is closed by default. */}
      <Section kind="rehearse" title={copy.DRILLS} count={drills.length} defaultOpen={false}>
        {drills.length === 0 ? (
          <p>{copy.NOT_YET_DRILLED}</p>
        ) : (
          <ul className="list history-list">
            {drills.map((row) => (
              <li key={row.id} className="card history-row">
                <p className="history-date">{row.date}</p>
                <p>{row.outcome}</p>
                <p className="figure">{row.packed}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* E5-US1-AC4 — one of two ways into a rehearsal (the other is the bar's
          Rehearse). It always leads to the gate, never straight into a
          rehearsal: whether one can start at all is decided there, from what
          this pack actually holds. */}
      <div className="actions">
        <Link className="action with-glyph" to={`/rehearse/${content.pack.id}`}>
          <Glyph kind="rehearse" line />
          {copy.REHEARSE_THIS_PACK}
        </Link>
      </div>

      {offlineSource ? (
        <div className="sheet-backdrop">
          <section
            className="card source-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offline-source-heading"
          >
            <div className="card-head">
              <Glyph kind="web" />
              <h2 id="offline-source-heading">{copy.SOURCE_IS_ON_WEB}</h2>
            </div>
            <ProvenanceLine source={offlineSource.source} now={now} open />
            <p className="muted">{copy.EXTERNAL_SOURCE_NOTICE}</p>
            {/* The stored citation answers "what was checked" here, in the app.
                Where there is one, the link behind it is the publisher's account
                of the dataset rather than the only readable statement of the
                result. */}
            {offlineSource.citation ? (
              <p className="source-citation">{offlineSource.citation}</p>
            ) : null}
            <a
              className={offlineSource.citation ? 'secondary-action' : undefined}
              href={offlineSource.pageUrl ?? DTP_DATASET_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {offlineSource.citation
                ? copy.CONTINUE_TO_DATASET_PAGE
                : copy.CONTINUE_TO_ORIGINAL_SOURCE}
            </a>
            <button ref={closeRef} type="button" onClick={() => setOfflineSource(null)}>
              {copy.CLOSE}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

/** One rehearsal's gaps line, with the ring that names each gap it found.
 *  Every row carries its own ring and its own panel, so both are named from the
 *  rehearsal's id; the panel opens in flow beneath the pair, covering no other
 *  rehearsal. Never on hover, as the other two information rings. */
function HistoryGaps({ id, gaps, found }: { id: string; gaps: string; found: HistoryRow['found'] }) {
  const [open, setOpen] = useState(false);
  const panel = useRevealedPanel<HTMLDivElement>(open);
  const panelId = `history-gaps-${id}`;

  return (
    <div className="history-gaps">
      <p className="figure">{gaps}</p>
      <button
        type="button"
        className="info-ring"
        aria-label={copy.ABOUT_GAPS}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <InfoGlyph />
      </button>
      {open ? (
        <div id={panelId} ref={panel} tabIndex={-1} className="card info-panel">
          <span className="kicker">{copy.ABOUT_GAPS}</span>
          <ul className="info-lines">
            <li>
              <b>{copy.GAP_WHAT_IS.lead}</b> {copy.GAP_WHAT_IS.text}
            </li>
            {found.length === 0 ? (
              <li>
                <b>{copy.GAP_NONE_FOUND.lead}</b> {copy.GAP_NONE_FOUND.text}
              </li>
            ) : (
              found.map((gap, index) => (
                <li key={index} className="gap-line">
                  <p>
                    <b>{gap.title}.</b> {gap.reason}
                  </p>
                  <p>
                    <b>{copy.ACTION_LABEL}.</b> {gap.action}
                  </p>
                </li>
              ))
            )}
            <li>
              <b>{copy.GAP_IS_A_COUNT.lead}</b> {copy.GAP_IS_A_COUNT.text}
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The stored bytes become a Blob of their own kind when opened. */
const mediaType = (name: string) => (name.endsWith('.png') ? 'image/png' : 'application/pdf');

/** How an item's original source opens: the copy saved in the pack first — a
 *  PDF of the page, handed to the phone as a file, no signal needed — then the
 *  live page on the web behind the explanation sheet. For a layer the page is
 *  the publisher's dataset page, not the stored query URL: that URL is a WFS
 *  endpoint answering in raw JSON, never a page. */
function SourceLinks({
  item,
  file,
  href,
  onWeb,
}: {
  item: PackDetailItem;
  file?: PackFile;
  href?: string;
  onWeb: (event: MouseEvent<HTMLAnchorElement>, item: PackDetailItem) => void;
}) {
  return (
    <>
      {/* The saved copy opens with no signal, so it leads; the web page
          follows. Each is told apart by its glyph. */}
      <div className="source-links">
        {file && href ? (
          <a className="action with-glyph" href={href} download={file.name}>
            <Glyph kind="documents" line />
            {copy.OPEN_SOURCE_FILE}
          </a>
        ) : null}
        <a
          className="action with-glyph"
          href={item.pageUrl ?? DTP_DATASET_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => onWeb(event, item)}
        >
          <Glyph kind="web" line />
          {copy.OPEN_ORIGINAL_SOURCE}
        </a>
      </div>
    </>
  );
}