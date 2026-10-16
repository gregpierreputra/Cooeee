import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { mapAcrossKm, mapBoxOf, mapPoint } from '../core/area-map-view';
import { areaResultLine } from '../core/area-check';
import { siteInSentence, siteNameBlock } from '../core/blacksky-dial';
import { AREA_MAP_NAME, DTP_DATASET_URL, DTP_LICENCE, DTP_PUBLISHER } from '../core/constants';
import * as copy from '../core/copy';
import { shownPackName, titleCase } from '../core/home';
import { packIcon } from '../core/pack';
import { formatDistanceM, placeName } from '../core/destination';
import {
  ageLabel,
  decideOriginalSourceAccess,
  packDetailAbsence,
  packDetailItems,
  packDetailPlaces,
} from '../core/provenance';
import { readKept } from '../core/kept';
import { monogram } from '../core/recover';
import { historyRows, type HistoryRow } from '../core/rehearsal-history';
import type { CompletePackContent, Drill, PackDetailItem, PackFile, Rehearsal } from '../core/types';
import { localFlagStore } from '../data/acknowledgement';
import { getCompletePackContent, listAllDrills, listRehearsalsForPack } from '../data/db';
import { syncKeptIntoPacks } from '../data/pack-programs';
import AreaMap from './components/AreaMap';
import Glyph, { type GlyphKind } from './components/Glyph';
import Hint from './components/Hint';
import KeyTerms from './components/KeyTerms';
import ProvenanceLine from './components/ProvenanceLine';
import Section from './components/Section';
import ShortList from './components/ShortList';
import WellbeingLines from './components/WellbeingLines';
import StateCard from './components/StateCard';
import StatusPage from './components/StatusPage';
import { useMinuteClock } from './components/useMinuteClock';
import { PlaceFacts } from './PackNew/Destinations';
import { PackNotes } from './PackNotes';

/** The pack page's five tabs, short enough to sit side by side on a phone.
 *  Each panel keeps its full heading inside. */
const PACK_TABS = [
  { key: 'area', glyph: 'map', label: copy.PACK_TAB_AREA },
  { key: 'places', glyph: 'place', label: copy.PACK_TAB_PLACES },
  { key: 'support', glyph: 'kept', label: copy.PACK_TAB_SUPPORT },
  { key: 'notes', glyph: 'note', label: copy.PACK_TAB_NOTES },
  { key: 'practice', glyph: 'rehearse', label: copy.PACK_TAB_PRACTICE },
] as const satisfies readonly { key: string; glyph: GlyphKind; label: string }[];
type PackTab = (typeof PACK_TABS)[number]['key'];

type PackDetailProps = {
  packId: string;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  loadRehearsals?: (id: string) => Promise<Rehearsal[]>;
  loadDrills?: () => Promise<Drill[]>;
  syncKept?: () => Promise<boolean>;
  now?: number;
};

/** Every saved pack takes in the programs saved in Recover, as Home does. */
const syncSavedPrograms = () => syncKeptIntoPacks(readKept(localFlagStore()));

/** A network-blind pack view. Every value comes from the complete-pack store;
 * every source tap is intercepted before browser navigation and requires a
 * second explicit choice before leaving Cooeee. */
export default function PackDetail({
  packId,
  loadContent = getCompletePackContent,
  loadRehearsals = listRehearsalsForPack,
  loadDrills = listAllDrills,
  syncKept = syncSavedPrograms,
  now: fixedNow,
}: PackDetailProps) {
  // Every age on the page moves on with the clock while it stays open.
  const now = useMinuteClock(fixedNow);
  const [content, setContent] = useState<CompletePackContent | null | undefined>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  // When the newest drill on the phone finished: null with none, undefined
  // until read, so the pill never flashes the wrong state.
  const [lastDrill, setLastDrill] = useState<number | null | undefined>(undefined);
  const [offlineSource, setOfflineSource] = useState<PackDetailItem | null>(null);
  // One object URL per stored file (the PDF copies and the area map), made
  // from the bytes already on the device and released with the screen. No
  // request is involved.
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const closeRef = useRef<HTMLButtonElement>(null);
  // Turns true once the pack has taken in a change saved in Recover, so a
  // program saved there shows here on Back without a trip to Home.
  const [synced, setSynced] = useState(false);
  // The open tab lives in the address, matched against the tabs on offer;
  // anything else opens on Area. Replaced, not pushed, so Back leaves the pack.
  const [params, setParams] = useSearchParams();
  const tab: PackTab = PACK_TABS.find((each) => each.key === params.get('tab'))?.key ?? 'area';
  const chooseTab = (next: PackTab) =>
    setParams(
      (current) => {
        current.set('tab', next);
        return current;
      },
      { replace: true },
    );
  // Left and Right step through the tabs, Home and End jump to either end, as
  // the tab pattern expects.
  const onTabKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const at = PACK_TABS.findIndex((each) => each.key === tab);
    const step: Record<string, number> = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: PACK_TABS.length - 1 };
    if (!(event.key in step)) return;
    event.preventDefault();
    const next = PACK_TABS[(step[event.key] + PACK_TABS.length) % PACK_TABS.length].key;
    chooseTab(next);
    document.getElementById(`pack-tab-${next}`)?.focus();
  };

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
  }, [loadContent, packId, synced]);

  // The pack shows straight from the store first; the sync can wait on a page
  // copy, and the pack is read again only if the sync changed it. The answer is
  // never thrown away: when the effect runs twice, the first sync makes the
  // change and the second finds nothing left to do, so only the first can say.
  useEffect(() => {
    syncKept().then(
      (changed) => {
        if (changed) setSynced(true);
      },
      () => {},
    );
  }, [syncKept]);

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

  // A drill belongs to no pack: the newest on the phone says whether one was played.
  useEffect(() => {
    let live = true;
    loadDrills().then(
      (rows) => {
        if (live) setLastDrill(rows.length ? Math.max(...rows.map((row) => row.finishedAt)) : null);
      },
      () => {
        if (live) setLastDrill(null);
      },
    );
    return () => {
      live = false;
    };
  }, [loadDrills]);

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
  // The stored map's picture, once its bytes are read; absent on older packs.
  const mapSrc = areaMap ? fileUrls[areaMap.id] : undefined;
  // The bushfire area layer is the one layer a pack saves: its item is stated
  // as the area check stated it. Any other item keeps its own name.
  const bpa = content.layers.find((row) => row.code === 'BPA');
  const answerOf = (item: PackDetailItem) => (item.id === bpa?.id ? areaResultLine(bpa.status) : item.name);
  // The gazetted plan an address inside the area matched, stated in Source.
  const areaPlan = items.find((item) => item.plan)?.plan;
  // The answer and the map are both the Department's: one Source row for them.
  const areaSource =
    items[0]?.source ??
    (areaMap ? { publisher: DTP_PUBLISHER, url: areaMap.url, licence: DTP_LICENCE, retrievedAt: areaMap.retrievedAt } : null);
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
      <header className="hero pack-detail-hero">
        <span className="kicker">{copy.EYEBROW_MY_PACK}</span>
        <div className="card-head">
          <Glyph kind={packIcon(content.pack)} />
          <h1 className="pack-name">{shownPackName(content.pack.name)}</h1>
        </div>
        <p className="muted">{content.pack.address}</p>
        {/* The same page the pack's menu on Home prints, as a small ring at the
            top right, where a pack card on Home keeps its menu. */}
        <Link className="card-more pack-print" to={`/packs/${encodeURIComponent(content.pack.id)}/print?from=pack&tab=${tab}`} aria-label={copy.PRINT_PACK}>
          <Glyph kind="print" line size={18} />
        </Link>
      </header>

      {/* One subject at a time. The open tab is kept in the address, so a
          reload or a return from printing comes back to it. Every panel stays
          in the page, only hidden, so a note being written survives a switch. */}
      <div className="pack-tabs" role="tablist" aria-label={copy.PACK_TABS_LABEL}>
        {PACK_TABS.map((each) => (
          <button
            key={each.key}
            id={`pack-tab-${each.key}`}
            type="button"
            role="tab"
            aria-selected={tab === each.key}
            aria-controls={`pack-panel-${each.key}`}
            tabIndex={tab === each.key ? 0 : -1}
            onClick={() => chooseTab(each.key)}
            onKeyDown={onTabKey}
          >
            <Glyph kind={each.glyph} line />
            {each.label}
          </button>
        ))}
      </div>

      <TabPanel tab="area" open={tab}>
        {!content.contentVerified ? <StateCard heading={copy.PACK_ITEMS_UNVERIFIED} /> : null}
        {/* The bushfire area: the answer the area check gave, in its own words,
            then the map that shades the same area, then one Source row for both,
            holding the gazetted plan the answer matched. The map is absent on packs built before it
            was stored; it zooms and moves, north up. */}
        {items.length > 0 || mapSrc ? (
          <Section kind="map" title={copy.BUSHFIRE_AREA}>
            {items.map((item) => {
              const isBpa = item.id === bpa?.id;
              // As on the area check: only inside is coloured, as only there is
              // the colour true. Every other answer is plain, and its one amber
              // line is that fire can still reach the person.
              const inside = isBpa && bpa.status === 'present';
              return (
                <div key={item.id} className="area-answer">
                  <h2>{inside ? <KeyTerms text={answerOf(item)} /> : answerOf(item)}</h2>
                  {isBpa && !inside ? (
                    <p className="muted">
                      <KeyTerms text={copy.AREA_MAP_IS_NOT_FIRE_REACH} />
                    </p>
                  ) : null}
                </div>
              );
            })}
            {mapSrc ? (
              <figure className="area-map">
                <AreaMap
                  src={mapSrc}
                  box={mapBox}
                  places={places}
                  address={content.pack.address}
                  scale={mapBox ? copy.AREA_MAP_ACROSS(mapAcrossKm(mapBox)) : undefined}
                />
                {/* The key is the map's own footer, inside its frame, and stays in
                    view, as the shading cannot be read without it. Each picture sits
                    in a slot of one width, so both columns of words start in line. */}
                <figcaption>
                  <ul className="map-key">
                    <li><span className="map-key-icon" aria-hidden="true"><span className="swatch swatch-inside" /></span>{copy.AREA_MAP_KEY.inside}</li>
                    <li><span className="map-key-icon" aria-hidden="true"><span className="swatch swatch-outside" /></span>{copy.AREA_MAP_KEY.outside}</li>
                    <li><span className="map-key-icon" aria-hidden="true"><span className="swatch swatch-place" /></span>{copy.AREA_MAP_KEY.place}</li>
                    <li><span className="map-key-icon area-map-mark-key" aria-hidden="true"><Glyph kind="place" size={14} /></span>{copy.AREA_MAP_KEY.lastResort}</li>
                  </ul>
                </figcaption>
              </figure>
            ) : null}
            {/* A chosen place past even the widest map is said in words, so it
                is never simply missing. */}
            {mapSrc && mapBox ? places.map((place) =>
              place.lat !== undefined && place.lon !== undefined && typeof place.distanceM === 'number'
                && !mapPoint(mapBox, { lat: place.lat, lon: place.lon }) ? (
                  <p key={place.id} className="muted place-note">
                    {copy.PLACE_OFF_MAP(siteInSentence(placeName(place)), formatDistanceM(place.distanceM))}
                  </p>
                ) : null) : null}
            {/* One row: Source, set as Not for you? is on Home, then the saved
                copy and the web page as small links beside it. */}
            {areaSource ? (
              <ProvenanceLine
                source={areaSource}
                now={now}
                extra={[
                  ...(areaPlan
                    ? [
                        { label: copy.SOURCE_PLAN, value: areaPlan.number },
                        { label: copy.SOURCE_GAZETTED, value: areaPlan.gazetted },
                        { label: copy.SOURCE_COUNCIL, value: titleCase(areaPlan.council) },
                      ]
                    : []),
                  { label: copy.SOURCE_LICENCE, value: areaSource.licence },
                ]}
                links={items[0] ? sourceLinks(items[0]) : null}
              />
            ) : null}
          </Section>
        ) : null}
        {!content.contentVerified || items.length > 0 || mapSrc || absence || places.length > 0 ? null : (
          <StateCard heading={copy.NO_STORED_ITEMS} />
        )}
      </TabPanel>

      <TabPanel tab="places" open={tab}>
        {!content.contentVerified ? <StateCard heading={copy.PACK_ITEMS_UNVERIFIED} /> : null}
        {/* A stored absence row: its own plain statement, never an item in the
            list and never a source to open. */}
        {absence ? <StateCard heading={absence} /> : null}
        {/* E2-US2: the two places the user chose, one under the other with equal
            weight. Distance is a fact about each; there is no ordinal and no
            ranking. No count: a pack always holds the two it was saved with. */}
        {places.length > 0 ? (
          <Section kind="place" title={copy.DESTINATIONS_STEP_TITLE}>
            {/* Every saved place is the one kind: said once, not on each card,
                in the one footnote with how its distance is measured. */}
            <p className="muted place-note">
              {copy.SAVED_PLACES_KIND(places.length)}
              {places.some((place) => typeof place.distanceM === 'number') ? (
                <> <KeyTerms text={copy.DISTANCES_NOTE} /></>
              ) : null}
            </p>
            <ul className="list saved-destinations">
              {places.map((place) => {
                const item = {
                  id: place.id,
                  name: placeName(place),
                  source: place.source,
                  pageUrl: place.source.url,
                };
                // Set as a card on Nearby: the site in bold with its distance
                // beside it, then where it is. The kind is said once, over the list.
                const { site, line } = siteNameBlock(item.name);
                return (
                  <li key={place.id} className="card provenance-item">
                    <div className="nearby-place">
                      <h2 className="nearby-place-name">{site}</h2>
                      {typeof place.distanceM === 'number' ? (
                        <p className="figure nearby-distance with-glyph">
                          <Glyph kind="go" line />
                          {formatDistanceM(place.distanceM)}
                        </p>
                      ) : null}
                    </div>
                    {line ? <p className="muted">{line}</p> : null}
                    <PlaceFacts place={place} now={now} links={sourceLinks(item)} />
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}
      </TabPanel>

      <TabPanel tab="support" open={tab}>
        {!content.recoveryVerified ? <StateCard heading={copy.RECOVERY_ITEMS_UNVERIFIED} /> : null}
        {/* E4-US7: the programs saved in Recover, each with the copy of its own
            page. Every pack carries the same list, so the line says so, and the
            way to save more is to Recover's full list. */}
        <Section kind="kept" title={copy.SAVED_PROGRAMS} count={content.recovery.length}>
          <p className="muted place-note">{copy.SAVED_PROGRAMS_SHARED}</p>
          {/* Nothing yet, in the same dashed box as Practice's rehearsals. */}
          {content.recovery.length === 0 ? (
            <div className="empty-state">
              <p>{copy.NO_SAVED_PROGRAMS}</p>
            </div>
          ) : (
            <ShortList
              items={content.recovery}
              className="list saved-programs"
              render={(program) => (
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
                  <ProvenanceLine
                    source={program.source}
                    now={now}
                    links={sourceLinks({ id: program.id, name: program.title, source: program.source, pageUrl: program.officialUrl })}
                  />
                </li>
              )}
            />
          )}
          {/* Drawn as New offline pack is: the plus, then the words. Marked as
              from this pack, so Back in Recover comes back here. */}
          <Link className="action with-glyph" to={`/recover?need=all&from=${encodeURIComponent(content.pack.id)}`}>
            <Glyph kind="plus" line />
            {copy.SAVE_MORE_PROGRAMS(content.recovery.length)}
          </Link>
        </Section>

        {/* R3: the wellbeing lines travel with every pack. */}
        <Section kind="calls" title={copy.TALK_TO_SOMEONE}>
          <p className="muted place-note">{copy.TALK_TO_SOMEONE_LINE}</p>
          <WellbeingLines />
        </Section>
      </TabPanel>

      <TabPanel tab="notes" open={tab}>
        <Section kind="note" title={copy.NOTES}>
          <PackNotes packId={content.pack.id} notes={content.notes} />
        </Section>
      </TabPanel>

      <TabPanel tab="practice" open={tab}>
        {/* E5-US1-AC4 — one of two ways into a rehearsal (the other is the bar's
            Rehearse). It always leads to the gate, never straight into a
            rehearsal: whether one can start at all is decided there, from what
            this pack actually holds. */}
        {/* Marked as from this pack, so Back on the rehearsal comes back here. */}
        <Link className="action main-action with-glyph" to={`/rehearse/${content.pack.id}?from=pack`}>
          <Glyph kind="rehearse" line />
          {copy.REHEARSE_THIS_PACK}
        </Link>
        {/* E5-US5 — every rehearsal of this pack, newest first, in the result's
            own words. */}
        <Section kind="rehearse" title={copy.REHEARSALS} count={history.length}>
          {/* Nothing yet, in the dashed box Home uses for no pack saved, so an
              empty list reads as room waiting to be filled. */}
          {history.length === 0 ? (
            <div className="empty-state">
              <p>{copy.NOT_YET_REHEARSED}</p>
            </div>
          ) : (
            <ShortList
              items={history}
              className="list history-list"
              render={(row) => (
                // Set as the other cards on this page: the condition as the
                // small teal label with the date beside it, the ending in bold,
                // then what the rehearsal found.
                <li key={row.id} className="card history-row practice-card">
                  <div className="practice-card-head">
                    <p className="place-kind">{row.condition}</p>
                    <p className="muted figure practice-date">{row.date}</p>
                  </div>
                  <p className="practice-outcome">{row.ending}</p>
                  <RehearsalGaps gaps={row.gaps} found={row.found} />
                </li>
              )}
            />
          )}
        </Section>

        {/* An invitation to the drill, part of getting ready whatever the
            pack, with whether one has been played on this phone, as a pack's
            rehearsal pill reads on Rehearse. Its results live on its own
            screen; Back and Done there come back to this tab. */}
        <Section kind="drill" title={copy.DRILL_LABEL}>
          <p className="muted place-note">{copy.DRILL_INVITE_LINE}</p>
          {lastDrill === undefined ? null : lastDrill === null ? (
            <p className="rehearsed-pill">{copy.NOT_DRILLED_CARD}</p>
          ) : (
            <p className="rehearsed-pill done with-glyph">
              <Glyph kind="check" line />
              {copy.DRILLED_AGO(ageLabel(now - lastDrill))}
            </p>
          )}
          <Link className="action with-glyph" to={`/rehearse/drill?from=${encodeURIComponent(content.pack.id)}`}>
            <Glyph kind="bag" line />
            {copy.DRILL_TILE_TITLE}
          </Link>
        </Section>
      </TabPanel>

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

/** What one rehearsal found. With nothing found, the four checks by short
 *  name; with gaps, each one named, why it was found and what to do, on the
 *  card where it can be acted on. What a gap is sits behind About gaps. */
function RehearsalGaps({ gaps, found }: { gaps: string; found: HistoryRow['found'] }) {
  return (
    <div className="practice-found">
      <p className="with-glyph practice-found-line">
        <Glyph kind={found.length === 0 ? 'check' : 'caution'} line />
        {gaps}
      </p>
      {found.length === 0 ? (
        <p className="muted place-note">{copy.GAPS_CHECKED}</p>
      ) : (
        <ul className="gap-list">
          {found.map((gap, index) => (
            <li key={index}>
              <p className="gap-title">{gap.title}</p>
              <p className="muted">{gap.reason}</p>
              {/* What to do on its own line, led by the result page's arrow and
                  at full strength, so it reads apart from the reason above. */}
              <p className="with-glyph gap-history-action">
                <Glyph kind="go" line />
                <span>
                  <b>{copy.ACTION_LABEL}.</b> {gap.action}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <Hint label={copy.ABOUT_GAPS} asText titled={false}>
        <p>{copy.GAP_ABOUT}</p>
      </Hint>
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
/** One tab's panel. Hidden, not removed, while another tab is open. */
function TabPanel({ tab, open, children }: { tab: PackTab; open: PackTab; children: ReactNode }) {
  return (
    <section
      id={`pack-panel-${tab}`}
      className="pack-panel"
      role="tabpanel"
      aria-labelledby={`pack-tab-${tab}`}
      hidden={tab !== open}
    >
      {children}
    </section>
  );
}

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
    // The saved copy opens with no signal, so it leads; the web page follows.
    // Small text links, so a card reads as its place, not as its buttons.
    <div className="source-links">
      {file && href ? (
        <a className="source-link" href={href} download={file.name}>
          <Glyph kind="documents" line size={16} />
          {copy.OPEN_SOURCE_FILE}
        </a>
      ) : null}
      <a
        className="source-link"
        href={item.pageUrl ?? DTP_DATASET_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => onWeb(event, item)}
      >
        <Glyph kind="web" line size={16} />
        {copy.OPEN_ORIGINAL_SOURCE}
      </a>
    </div>
  );
}