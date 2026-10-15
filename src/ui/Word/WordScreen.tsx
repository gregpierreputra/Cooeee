import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { melbourneDay } from '../../core/day';
import type { WordDay } from '../../core/types';
import {
  WORD_GUESSES,
  answerIndexFor,
  checkGuess,
  inWordList,
  keyboardMarks,
  PAST_WORDS_SHOWN,
  pastWords,
  puzzleNumber,
  statusAfter,
  wordTileView,
} from '../../core/word';
import type { WordAnswer, WordSource } from '../../core/word-answers';
import { getWordDay, listWordDays, saveWordDay } from '../../data/db';
import { focusMain } from '../components/focusMain';
import WordGrid from './WordGrid';
import WordKeyboard from './WordKeyboard';
import { fetchWordList } from './word-list';
import Glyph from '../components/Glyph';
import TabLabel from '../components/TabLabel';
import FactTiles from '../Games/FactTiles';
import ShortList from '../components/ShortList';

type Answers = { WORD_ANSWERS: readonly WordAnswer[]; WORD_SOURCES: Record<WordSource, string> };

type Props = {
  /** A fixed time, for tests. The day is settled from it once. */
  now?: number;
  /** Injectable for tests. The answers are a large file, loaded only here. */
  loadAnswers?: () => Promise<Answers>;
  loadList?: (length: number) => Promise<string>;
  loadDay?: (day: number) => Promise<WordDay | undefined>;
  saveDay?: (row: WordDay) => Promise<void>;
  loadAll?: () => Promise<WordDay[]>;
};

type Ready = {
  answer: string;
  /** The day's hint: the answer's theme and its clue. */
  hint: { theme: string; clue: string } | null;
  fact: { text: string; source: string } | null;
  /** Why an earlier day's word matters, for the past words. */
  factFor: (word: string) => { text: string; source: string } | null;
  /** The real words of this length, or null when they could not be loaded. */
  list: string | null;
};

const defaultAnswers = () => import('../../core/word-answers');

/** Cooee Word — today's word, six guesses, then the word's fact. Every guess
 *  is kept as it is entered, so leaving and coming back carries on. */
export default function WordScreen({
  now,
  loadAnswers = defaultAnswers,
  loadList = fetchWordList,
  loadDay = getWordDay,
  saveDay = saveWordDay,
  loadAll = listWordDays,
}: Props) {
  const navigate = useNavigate();
  // The day is settled as the screen opens, so a game played across
  // midnight is kept as the day it started.
  const [day] = useState(() => melbourneDay(now ?? Date.now()));
  const [ready, setReady] = useState<Ready | null>(null);
  const [failed, setFailed] = useState(false);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<WordDay[]>([]);
  // Past words wait behind their toggle, and one at a time shows why it matters.
  const [pastOpen, setPastOpen] = useState(false);
  const [openPast, setOpenPast] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const { WORD_ANSWERS, WORD_SOURCES } = await loadAnswers();
      const saved = await loadDay(day).catch(() => undefined);
      const answer = saved?.answer ?? WORD_ANSWERS[answerIndexFor(day, WORD_ANSWERS.length)].word;
      const entry = WORD_ANSWERS.find((candidate) => candidate.word === answer);
      const list = await loadList(answer.length).catch(() => null);
      const rows = await loadAll().catch(() => []);
      if (!live) return;
      setGuesses(saved?.guesses ?? []);
      setHistory(rows);
      setReady({
        answer,
        list,
        hint: entry ? { theme: copy.WORD_THEMES[entry.theme], clue: entry.clue } : null,
        fact: entry ? { text: entry.fact, source: WORD_SOURCES[entry.source] } : null,
        factFor: (word) => {
          const past = WORD_ANSWERS.find((candidate) => candidate.word === word);
          return past ? { text: past.fact, source: WORD_SOURCES[past.source] } : null;
        },
      });
    })().catch(() => {
      if (live) setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [day, loadAnswers, loadDay, loadList, loadAll]);

  const status = ready ? statusAfter(guesses, ready.answer) : 'playing';
  const done = status !== 'playing';

  useEffect(() => {
    if (done || failed) focusMain();
  }, [done, failed]);

  const type = useCallback(
    (key: string) => {
      if (!ready || done) return;
      setMessage('');
      if (key === 'Enter') {
        const check = checkGuess(typed, ready.answer.length, ready.list === null || inWordList(ready.list, ready.answer.length, typed), guesses);
        if (check === 'short') return setMessage(copy.WORD_TOO_SHORT(ready.answer.length));
        if (check === 'repeat') return setMessage(copy.WORD_ALREADY_TRIED);
        if (check === 'not-a-word') return setMessage(copy.WORD_NOT_IN_LIST);
        const next = [...guesses, typed];
        const nextStatus = statusAfter(next, ready.answer);
        const at = Date.now();
        const row: WordDay = {
          day,
          answer: ready.answer,
          guesses: next,
          status: nextStatus,
          updatedAt: at,
          ...(nextStatus === 'playing' ? {} : { finishedAt: at }),
        };
        setGuesses(next);
        setTyped('');
        if (nextStatus === 'playing') setMessage(copy.WORD_GUESSES_LEFT(WORD_GUESSES - next.length));
        setHistory((rows) => [...rows.filter((other) => other.day !== day), row]);
        // A store that refuses costs this game nothing; only the card's
        // count would miss the day.
        saveDay(row).catch(() => undefined);
        return;
      }
      if (key === 'Backspace') return setTyped((text) => text.slice(0, -1));
      if (/^[a-z]$/.test(key)) setTyped((text) => (text.length < ready.answer.length ? text + key : text));
    },
    [ready, done, typed, guesses, day, saveDay],
  );

  // The phone's keyboard types through a field that always holds one space, so
  // a delete on an empty guess still reaches it. Letters typed there, or the
  // space deleted, are read and the space put back. Keys that a phone reports
  // by name are already typed by the listener below, which stops them here.
  const phoneRef = useRef<HTMLInputElement>(null);
  const phoneInput = (event: FormEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    if (field.value === '') type('Backspace');
    for (const letter of field.value.replace(' ', '').toLowerCase()) {
      if (/^[a-z]$/.test(letter)) type(letter);
    }
    field.value = ' ';
    field.setSelectionRange(1, 1);
  };

  // A keyboard types too, unless a button has the focus for Enter or Space.
  // The listener reads the latest typing through a ref, so keys pressed
  // faster than a render never act on a guess as it stood a key ago.
  const typeRef = useRef(type);
  typeRef.current = type;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const onButton = (event.target as HTMLElement | null)?.tagName === 'BUTTON';
      if (event.key === 'Enter' && onButton) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === 'Enter' || key === 'Backspace' || /^[a-z]$/.test(key)) {
        event.preventDefault();
        typeRef.current(key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const view = wordTileView(history, day);
  const past = pastWords(history, day);

  return (
    <main className="page word-page">
      <TabLabel tab="rehearse" text={copy.WORD_LABEL} />
      {failed ? (
        <>
          <div className="card" role="status">
            <p>{copy.WORD_UNAVAILABLE}</p>
          </div>
          <div className="actions">
            <button type="button" className="action main-action" onClick={() => navigate('/rehearse')}>
              {copy.BACK_TO_REHEARSE}
            </button>
          </div>
        </>
      ) : ready === null ? null : (
        <>
          <div className="hero word-hero">
            <h1>{copy.WORD_NUMBER(puzzleNumber(day))}</h1>
            <p className="muted">{copy.WORD_PURPOSE}</p>
            {ready.list === null ? <p className="muted">{copy.WORD_LIST_UNAVAILABLE}</p> : null}
          </div>
          {/* How to play, in pictures rather than sentences: the three figures,
              then what each colour means. The hint follows, by the guesses. */}
          <section className="word-how" aria-labelledby="word-how-label">
            <h2 id="word-how-label" className="kicker section-label">{copy.WORD_HOW_TO_PLAY}</h2>
            <FactTiles facts={copy.WORD_FACTS(ready.answer.length)} />
            <ul className="word-legend">
              <li><span className="word-cell mark-right" aria-hidden="true" />{copy.WORD_KEY_RIGHT}</li>
              <li><span className="word-cell mark-present" aria-hidden="true" />{copy.WORD_KEY_PRESENT}</li>
              <li><span className="word-cell mark-absent" aria-hidden="true" />{copy.WORD_KEY_ABSENT}</li>
            </ul>
          </section>
          {ready.hint ? (
            <aside className="word-hint" aria-label={copy.WORD_HINT_LABEL}>
              <span className="word-hint-theme">{ready.hint.theme}</span>
              <p className="word-hint-clue">{ready.hint.clue}</p>
            </aside>
          ) : null}
          {/* Above the guesses, so on a small phone it is in view with them. On
              a computer, with nothing to open, it is not shown. */}
          {done ? null : (
            <button type="button" className="hint-text word-phone-open" onClick={() => phoneRef.current?.focus()}>
              {copy.WORD_PHONE_KEYBOARD}
            </button>
          )}
          {/* A tap on the guesses opens the phone's own keyboard through a field
              laid over them, so on a small phone the guesses stay in view above
              it. The keys below still work, and keep their colours. */}
          <div className="word-board">
            <WordGrid answer={ready.answer} guesses={guesses} typed={done ? '' : typed} />
            {done ? null : (
              <input
                ref={phoneRef}
                className="word-phone-input"
                aria-label={copy.WORD_TYPE_LABEL}
                defaultValue=" "
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                onFocus={(event) => event.currentTarget.setSelectionRange(1, 1)}
                onInput={phoneInput}
              />
            )}
          </div>
          <p className="word-message" role="status" aria-live="polite">
            {message}
          </p>
          {done ? (
            <div className="word-result">
              {/* In parts: the outcome, the word in its own tiles, the three
                  figures, why it matters, and when the next word comes. */}
              <section className="card word-result-card" aria-labelledby="word-result-heading">
                <div className={status === 'won' ? 'word-result-head won' : 'word-result-head'}>
                  <Glyph kind={status === 'won' ? 'check' : 'word'} />
                  <h2 id="word-result-heading">{status === 'won' ? copy.WORD_SOLVED(guesses.length) : copy.WORD_NOT_SOLVED}</h2>
                </div>
                <p className="word-answer-tiles" role="img" aria-label={copy.WORD_ANSWER_WAS(ready.answer)}>
                  {[...ready.answer].map((letter, i) => (
                    <span key={i} className={status === 'won' ? 'word-cell mark-right' : 'word-cell'}>
                      {letter.toUpperCase()}
                    </span>
                  ))}
                </p>
                <FactTiles facts={copy.WORD_RESULT_STATS(view.streak, view.played, guesses.length)} />
                {ready.fact ? (
                  <div className="word-fact">
                    <p className="kicker">{copy.WORD_FACT_LABEL}</p>
                    <p>{ready.fact.text}</p>
                    <p className="muted">{copy.WORD_FACT_SOURCE(ready.fact.source)}</p>
                  </div>
                ) : null}
                <p className="muted with-glyph word-come-back">
                  <Glyph kind="clock" line />
                  {copy.WORD_COME_BACK}
                </p>
              </section>
              {/* The words of the days before, newest first, behind a toggle so
                  Done stays close to the result. Seven show, then Show more
                  for the rest, as the pack page's lists do. Each opens why it
                  matters, one at a time. */}
              {past.length > 0 ? (
                <section className="word-past" aria-labelledby="word-past-toggle">
                  <button
                    id="word-past-toggle"
                    type="button"
                    className="hint-text"
                    aria-expanded={pastOpen}
                    aria-controls="word-past-list"
                    onClick={() => setPastOpen((open) => !open)}
                  >
                    {copy.WORD_PAST_LABEL}
                    <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {pastOpen ? (
                    <div id="word-past-list" className="word-past-body">
                      <ShortList
                        items={past}
                        limit={PAST_WORDS_SHOWN}
                        className="card word-past-list"
                        render={(word) => {
                          const open = openPast === word.number;
                          const fact = open ? ready.factFor(word.word) : null;
                          return (
                            <li key={word.number} className="word-past-row">
                              <button
                                type="button"
                                className="word-past-button"
                                aria-expanded={open}
                                onClick={() => setOpenPast(open ? null : word.number)}
                              >
                                <span className="word-past-head">
                                  <span className="figure">{copy.WORD_NUMBER(word.number)}</span>
                                  <span className={`word-past-outcome ${word.status}`}>
                                    {word.status === 'won'
                                      ? copy.WORD_PAST_SOLVED(word.guesses)
                                      : word.status === 'lost'
                                        ? copy.WORD_PAST_NOT_SOLVED
                                        : copy.WORD_PAST_UNFINISHED}
                                  </span>
                                </span>
                                <span className="word-past-tiles">
                                  {[...word.word].map((letter, i) => (
                                    <span
                                      key={i}
                                      className={word.status === 'won' ? 'word-cell mark-right' : 'word-cell'}
                                      aria-hidden="true"
                                    >
                                      {letter.toUpperCase()}
                                    </span>
                                  ))}
                                  <span className="visually-hidden">{word.word.toUpperCase()}</span>
                                  <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                                    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </span>
                              </button>
                              {fact ? (
                                <div className="word-fact">
                                  <p className="kicker">{copy.WORD_FACT_LABEL}</p>
                                  <p>{fact.text}</p>
                                  <p className="muted">{copy.WORD_FACT_SOURCE(fact.source)}</p>
                                </div>
                              ) : null}
                            </li>
                          );
                        }}
                      />
                    </div>
                  ) : null}
                </section>
              ) : null}
              <div className="actions">
                <button type="button" className="action main-action" onClick={() => navigate('/rehearse')}>
                  {copy.GAME_DONE}
                </button>
              </div>
            </div>
          ) : (
            <WordKeyboard marks={keyboardMarks(guesses, ready.answer)} onKey={type} />
          )}
        </>
      )}
    </main>
  );
}
