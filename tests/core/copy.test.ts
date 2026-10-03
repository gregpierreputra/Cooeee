import { describe, expect, it } from 'vitest';
import { HOTLINE_NUMBER } from '../../src/core/constants';
import * as copy from '../../src/core/copy';

// Exact match, character for character, em dashes and the ± sign included. These
// lines are the product's central safety claim, so a reword is a test failure and
// not a style discussion.
describe('mandated literals', () => {
  it('destinations are never ranked by worth', () => {
    expect(copy.SORTED_BY_DISTANCE).toBe('sorted by distance, not a safety ranking');
  });

  // Exact match including punctuation. The literal carries no dash of any
  // kind: the em dash it once had is gone, and a hyphen-minus in its place
  // would be a different sentence.
  it('an unmatched address says what to try next, with no dash of any kind', () => {
    expect(copy.NO_ADDRESS_MATCH).toBe('No match. Check the spelling or try a cross street.');
    expect(copy.NO_ADDRESS_MATCH).not.toContain('\u2014');
    expect(copy.NO_ADDRESS_MATCH).not.toContain('-');
  });

  it('no fix falls back to saved information, in words', () => {
    expect(copy.NO_GPS).toBe('No GPS fix. Showing saved information.');
  });

  it('a vague or old fix reports its own figure beside the arrow, never instead of it', () => {
    expect(copy.GPS_APPROXIMATE(240)).toBe('GPS ± 240 m here. Direction is approximate.');
    expect(copy.FIX_AGE(45)).toBe('GPS fix 45 s old. Direction may have changed.');
  });

  it("being outside the loaded pack's area is stated plainly", () => {
    expect(copy.OUTSIDE_AREAS).toBe("You're outside this pack's area");
  });

  it('a stale pack is labelled without being disabled', () => {
    expect(copy.NOT_RECENTLY_VERIFIED(96)).toBe('Saved 96 days ago, not recently verified');
  });

  it('the app states what it cannot detect', () => {
    expect(copy.PHONE_MAY_WORK).toBe(
      'Calls may work if your phone shows signal. This app cannot detect it.',
    );
  });
});

describe('composed lines', () => {
  it('a fresh pack is dated without a verdict attached', () => {
    expect(copy.SAVED_DAYS_AGO(3)).toBe('Saved 3 days ago');
  });

  it('the choose hint counts one place versus two', () => {
    expect(copy.CHOOSE_PLACES_HINT(1)).toBe('Choose one');
    expect(copy.CHOOSE_PLACES_HINT(2)).toBe('Choose two');
  });
});

describe('shell copy', () => {
  it('states an update is waiting and that nothing changes until the user chooses', () => {
    expect(copy.NEW_VERSION_READY).toContain('Nothing changes until you reload');
  });

  it('says a pack is missing without implying anything about the place', () => {
    expect(copy.NO_PACKS_HINT).toContain('while you have a connection');
  });

  it('welcomes in three moments and two facts, one short line each', () => {
    expect(copy.WELCOME_STEPS.map((step) => step.kicker)).toEqual(['Before', 'During', 'After']);
    for (const line of [...copy.WELCOME_STEPS, ...copy.WELCOME_FACTS].map((s) => s.line)) {
      expect(line.split(' ').length).toBeLessThanOrEqual(8);
    }
    expect(copy.SEE_HOW_IT_WORKS).toBe('See how it works');
  });

  it('labels the endings card on the journey screen', () => {
    expect(copy.JOURNEY_ENDINGS_LABEL).toBe('When you are done');
  });

  it('carries the tagline the splash shows on arrival', () => {
    expect(copy.APP_TAGLINE).toBe(
      'Your offline-capable life-saver supporting you before, during, and after disasters.',
    );
  });
});

describe('E1-US2 mandated provenance and offline-source copy', () => {
  it('states why one item was omitted and the storage rule behind it', () => {
    expect(copy.ITEM_LEFT_OUT).toBe('One item left out');
    expect(copy.ITEM_LEFT_OUT_REASON).toBe('No publisher or date was given.');
    expect(copy.PROVENANCE_STORAGE_RULE).toBe('Cooeee keeps only information with a source.');
    expect(copy.ITEMS_LEFT_OUT(2)).toBe('2 items left out');
  });

  it('states what an offline source tap cannot do and what remains local', () => {
    expect(copy.SOURCE_IS_ON_WEB).toBe('Opens on the web');
    // What stays local is the saved copy of the source, named apart from the web page.
    expect(copy.OPEN_SOURCE_FILE).toBe('Saved PDF');
    expect(copy.OPEN_ORIGINAL_SOURCE).toBe('Web page');
    expect(copy.EXTERNAL_SOURCE_NOTICE).toBe('May use your connection and leave Cooeee.');
    expect(copy.CONTINUE_TO_ORIGINAL_SOURCE).toBe('Continue to the web page');
    // Both labels lead to the publisher's page for the dataset; neither promises
    // a statement of this one result on the far end.
    expect(copy.CONTINUE_TO_DATASET_PAGE).toBe("Continue to the publisher's dataset page");
  });

  it('formats the shared publisher and saved date line exactly', () => {
    expect(copy.PROVENANCE_LINE('Department of Transport and Planning', '3 March 2026')).toBe(
      'Published by Department of Transport and Planning · Saved 3 March 2026',
    );
  });
});

// The eyebrow and the flow step labels are stored sentence case and rendered
// uppercase by .kicker. The casing is an accessibility decision — an all-caps
// string in the DOM is spelled out letter by letter by some screen readers — so
// it is asserted here rather than left to whoever next edits the file.
describe('screen eyebrows and flow steps', () => {
  it('names the five steps of the build flow, one glyph and one word each', () => {
    expect(copy.FLOW_STEPS.map((step) => step.label)).toEqual([
      'Address',
      'Area',
      'Places',
      'Note',
      'Save',
    ]);
    for (const step of copy.FLOW_STEPS) {
      expect(step.glyph).toBeTruthy();
      expect(step.label).toMatch(/^\S+$/);
    }
    expect(copy.EYEBROW_MY_PACK).toBe('My pack');
  });

  it('stores sentence case, so the capitals stay a visual transform', () => {
    for (const eyebrow of [...copy.FLOW_STEPS.map((step) => step.label), copy.EYEBROW_MY_PACK]) {
      expect(eyebrow).not.toBe(eyebrow.toUpperCase());
      expect(eyebrow).toBe(eyebrow[0].toUpperCase() + eyebrow.slice(1).toLowerCase());
    }
  });
});

// E3-US1-AC1: the whole BlackSky display is these formatters. If one drifts,
// the screen shows a figure the register never promised.
describe('BlackSky bearing and distance figures', () => {
  it('reads accuracy back with the ± sign', () => {
    expect(copy.ACCURACY_READOUT(12)).toBe('± 12 m');
  });

  it('shows metres under a kilometre, ten metre steps under ten, one decimal above', () => {
    expect(copy.distanceLabel(850)).toBe('850 m');
    expect(copy.distanceLabel(999.4)).toBe('999 m');
    expect(copy.distanceLabel(999.6)).toBe('1.00 km'); // never '1000 m'
    expect(copy.distanceLabel(1120)).toBe('1.12 km');
    expect(copy.distanceLabel(2700)).toBe('2.70 km');
    expect(copy.distanceLabel(12_340)).toBe('12.3 km');
  });
});

describe('BlackSky compass sectors', () => {
  it('has 8 named points, one per 45-degree sector, north first', () => {
    expect(copy.CARDINAL_POINTS).toHaveLength(8);
    expect(copy.CARDINAL_POINTS[0]).toBe('North');
    expect(copy.CARDINAL_POINTS[1]).toBe('North-east');
    expect(copy.CARDINAL_POINTS[4]).toBe('South');
  });
});

// E3-US1-AC4: a marked position must never read like a fix.
describe('marked-position estimate copy', () => {
  it('is labelled ESTIMATE with the uncertainty stated as growing', () => {
    expect(copy.ESTIMATE_READOUT(53)).toBe('ESTIMATE from your mark, ± 53 m and growing');
  });
});

// E3-US2-AC1: the emergency figures are safety copy — a wrong number here is
// the worst possible typo, so each is pinned character for character.
describe('general official guidance', () => {
  it('carries the exact emergency numbers', () => {
    expect(copy.CALL_TRIPLE_ZERO).toBe('Call 000 (Triple Zero) for life-threatening emergencies.');
    expect(copy.VICEMERGENCY_HOTLINE).toBe('VicEmergency hotline 1800 226 226.');
  });

  it('states the area distance without implying a direction', () => {
    expect(copy.AREA_DISTANCE_LINE('9.2 km')).toBe('9.2 km to its area');
  });
});

describe('several packs stored', () => {
  it('asks which pack to load, and says the nearest places show either way', () => {
    expect(copy.CHOOSE_PACK).toBe('Choose a pack');
    expect(copy.CHOOSE_PACK_HINT).toBe(
      'Loads its places and notes. The nearest official places show either way.',
    );
    expect(copy.PACK_COVERS_HERE).toBe('Covers where you are');
    expect(copy.NO_GPS_YET).toBe('No GPS fix yet.');
  });
});

// E3-US2-AC2: the no-pack statement — absence stated plainly, nothing invented.
describe('no pack stored', () => {
  it('states that no saved pack covers this place', () => {
    expect(copy.NO_PACK_HERE).toBe('No saved pack covers this place.');
  });
});

// E3-US2-AC3: every saved place is described by the official term, with its
// source — and by nothing that promises anything about it.
describe('place descriptor', () => {
  it('names the place kind and its publisher, nothing more', () => {
    expect(copy.PLACE_DESCRIPTOR('CFA')).toBe('Official place of last resort · CFA');
  });
});

// E3-US3-AC1: deliberate activation — the stray-tap hint and the one exit.
describe('deliberate activation', () => {
  it('a stray tap earns only the hold hint', () => {
    expect(copy.HOLD_TO_ENTER).toBe('Hold to enter. Two seconds.');
  });

  it('leaving the mode is one plainly named action, and its label says to hold', () => {
    expect(copy.LEAVE_BLACKSKY).toBe('Hold to leave');
    expect(copy.HOLD_TO_LEAVE).toBe('Hold to leave. Two seconds.');
  });

  it('a back press and a return both name the one way out', () => {
    expect(copy.BACK_PRESSED).toBe('Back does not leave BlackSky. Use Hold to leave at the top.');
    expect(copy.BLACKSKY_RESUMED).toBe(
      'Reopened where you left off. To exit, use Hold to leave at the top.',
    );
    // Both name the control by the label it actually carries.
    for (const notice of [copy.BACK_PRESSED, copy.BLACKSKY_RESUMED]) expect(notice).toContain(copy.LEAVE_BLACKSKY);
    expect(copy.BACK_PRESSED).not.toContain('Leave BlackSky');
  });
});

// E1-US2-AC6: the header's three age states are exact strings, and the two
// age wordings in the product must stay distinguishable — the card reports when
// the pack was written, the header when its contents were last checked.
describe('the fixed header', () => {
  it('states the age in days inside the refresh window', () => {
    expect(copy.CHECKED_DAYS_AGO(0)).toBe('Checked 0 days ago');
    expect(copy.CHECKED_DAYS_AGO(30)).toBe('Checked 30 days ago');
  });

  it('carries the label, and no verdict, past the window', () => {
    expect(copy.NOT_RECENTLY_VERIFIED_LABEL).toBe('Not recently verified');
  });

  it('keeps the header wording distinct from the pack card wording', () => {
    expect(copy.CHECKED_DAYS_AGO(3)).not.toBe(copy.SAVED_DAYS_AGO(3));
  });

  it('gives the wordless dismissed connection notice its whole meaning in its name', () => {
    expect(copy.CONNECTION_ONLINE_LABEL).toBe('Connection: your browser reports a network.');
    expect(copy.CONNECTION_OFFLINE_LABEL).toBe('Connection: your browser reports no network.');
  });
});

describe('the returning-user home', () => {
  it('states that no pack is saved, and offers to build one', () => {
    expect(copy.NO_PACK_SAVED).toBe('No pack saved yet.');
    expect(copy.BUILD_A_PACK).toBe('New offline pack');
  });

  it('labels the preparation line as a daily reminder', () => {
    expect(copy.PREPARATION_LABEL).toBe("Today's reminder");
  });

  it('tours eleven features across every screen, each a title, a glyph and one short line', () => {
    expect(copy.TOUR_STEPS.map((step) => step.title)).toEqual([
      "Today's reminder",
      'Your saved packs',
      'New offline pack',
      'Hold for BlackSky',
      'The header',
      'The bottom bar',
      'The address search',
      'Nearby official places',
      'Rehearse',
      'Recover',
      'About Cooeee',
    ]);
    for (const step of copy.TOUR_STEPS) {
      expect(step.path.startsWith('/')).toBe(true);
      expect(step.glyph).toBeTruthy();
      expect(step.line.split(' ').length).toBeLessThanOrEqual(12);
    }
    expect(copy.SKIP_TOUR).toBe('Skip tour');
  });

  it('says what Cooeee is on the About page, glyph-led plain sentences with no colon, semicolon or dash', () => {
    expect(copy.ABOUT_COOEEE).toBe('About Cooeee');
    expect(copy.COOEEE_INFO_LINES.map((line) => line.glyph)).toEqual([
      'what',
      'why',
      'does',
      'not',
      'stays',
    ]);
    for (const line of copy.COOEEE_INFO_LINES) {
      expect(Object.keys(line)).toEqual(['glyph', 'title', 'text']);
      expect(line.title).not.toMatch(/[:;\u2013\u2014-]/);
      expect(line.text).not.toMatch(/[:;\u2013\u2014-]/);
    }
  });

  it('says what BlackSky does in four glyph-led lines, the last naming the two-second hold', () => {
    expect(copy.ABOUT_BLACKSKY).toBe('About BlackSky');
    expect(copy.BLACKSKY_INFO_LINES.map((line) => line.glyph)).toEqual([
      'go',
      'offline',
      'moon',
      'clock',
    ]);
    for (const line of copy.BLACKSKY_INFO_LINES) {
      expect(Object.keys(line)).toEqual(['glyph', 'text']);
    }
    expect(copy.BLACKSKY_INFO_LINES[1].text).toContain('no signal');
    expect(copy.BLACKSKY_INFO_LINES[3].text).toContain('two seconds');
  });

  it('credits the guidance behind the preparation line, without quoting it', () => {
    expect(copy.PREPARATION_SOURCE).toBe('Country Fire Authority guidance');
    expect(copy.PREPARATION_SOURCE).not.toMatch(/["“”]/);
  });

  it('says nothing about conditions, incidents or being prepared enough', () => {
    for (const line of copy.PREPARATION_LINES) {
      expect(`${line.text} ${line.context}`).not.toMatch(
        /today|right now|currently|well done|you should have/i,
      );
    }
  });
});

// E1-US1-AC0: the four disclosure statements are the screen. Each is pinned
// character for character, because a reworded statement is a different
// disclosure from the one the user acknowledged.
describe('first-open disclosure', () => {
  it('states the purpose in one line', () => {
    expect(copy.FIRST_OPEN_PURPOSE).toBe(
      'Get one address ready now, for bushfire information that still opens when the signal drops.',
    );
  });

  it('states what Cooeee does', () => {
    expect(copy.DISCLOSURE_DOES).toBe(
      'Saves preparation packs for the addresses you choose, on this phone. They open with no signal.',
    );
  });

  it('states what Cooeee does not do, including that it issues no warnings', () => {
    expect(copy.DISCLOSURE_DOES_NOT).toBe(
      'Does not watch conditions, and will never contact you. Nothing here tells you when to act.',
    );
  });

  it('states where the address goes and what stays on the device', () => {
    expect(copy.DISCLOSURE_ADDRESS).toBe(
      'On this phone once saved. Checking your address uses Victorian Government data, and we run no server that could hold it.',
    );
  });

  it('states when the position is asked for and that it is never sent', () => {
    expect(copy.DISCLOSURE_POSITION).toBe(
      'Only asked inside BlackSky, the offline screen that points to your saved places. Stays on this device. You can refuse, and everything else still works.',
    );
  });

  it('names the official channels for what Cooeee itself never provides', () => {
    expect(copy.OFFICIAL_CHANNELS_LINE).toBe(
      'During an incident, official updates come from VicEmergency. In an emergency, call Triple Zero (000).',
    );
  });

  it('the acknowledgement covers both what the app does and what it does not', () => {
    expect(copy.ACKNOWLEDGE_CHECKBOX).toBe(
      'I understand how Cooeee works, and what it does not do.',
    );
    expect(copy.BEFORE_YOU_CONTINUE).toBe('Before you continue');
    expect(copy.ACKNOWLEDGE_HINT).toBe('Tick the box above to continue.');
  });

  // The disclosure is the one screen that must not read as reassurance while
  // explaining what the product is. Nothing here may promise an outcome.
  it('no statement claims Cooeee monitors, notifies or keeps the user informed', () => {
    const statements = [
      copy.FIRST_OPEN_PURPOSE,
      copy.DISCLOSURE_DOES,
      copy.DISCLOSURE_DOES_NOT,
      copy.DISCLOSURE_ADDRESS,
      copy.DISCLOSURE_POSITION,
      copy.OFFICIAL_CHANNELS_LINE,
      copy.ACKNOWLEDGE_CHECKBOX,
    ].join(' ');
    expect(statements).not.toMatch(/\bmonitors\b|\bnotifies\b|\bkeeps you informed\b/i);
    expect(statements).toMatch(/[Dd]oes not watch conditions/);
  });
});

// E4 Recover: the lines that carry the may-match boundary and the privacy claim.
describe('E4 Recover mandated copy', () => {
  it('frames every result as a possible match the organisation decides on', () => {
    expect(copy.RECOVER_MAY_MATCH).toBe(
      'These may match. The responsible organisation decides who is eligible.',
    );
  });

  it('says what is shared, and that the caveat travels with a shared list', () => {
    expect(copy.SHARED_FROM).toBe('Shared from Cooeee. Programs change, and the organisation decides.');
    expect(copy.PREPARATION_LINES.filter((line) => line.source === copy.PREPARATION_SOURCE_RECOVERY)).toHaveLength(2);
  });

  it('names the saved programs section, its one control and the Home nudge', () => {
    expect(copy.SAVED_PROGRAMS).toBe('Saved programs');
    expect(copy.SHOW).toBe('Show');
    expect(copy.HIDE).toBe('Hide');
    expect(copy.SHOW_SECTION('Saved programs')).toBe('Show Saved programs');
    expect(copy.HIDE_SECTION('Notes')).toBe('Hide Notes');
    expect(copy.STORED_INFORMATION).toBe('Stored information');
    expect(copy.KEPT_NOT_SAVED(1)).toBe('1 saved program is not in a pack yet');
    expect(copy.KEPT_NOT_SAVED(2)).toBe('2 saved programs are not in a pack yet');
  });

  it('names the way to programs, and the in-your-packs line', () => {
    expect(copy.VICEMERGENCY_HOTLINE).toContain(HOTLINE_NUMBER);
    expect(copy.CHOOSE_IN_RECOVER).toBe('Choose programs in Recover');
    expect(copy.IN_YOUR_PACKS).toBe('In your packs');
    for (const line of copy.COOEEE_INFO_LINES) expect(line.glyph).toBeTruthy();
  });

  it('names the call list and the print control', () => {
    expect(copy.WHO_TO_CALL).toBe('Who to call');
    expect(copy.HOTLINE_LABEL).toBe('VicEmergency hotline');
    expect(copy.PRINT_LIST).toBe('Print this list');
  });

  it('states that nothing chosen leaves the phone', () => {
    expect(copy.RECOVER_PRIVACY_LINE).toBe(
      'Nothing leaves this phone. Only the programs you save and the steps you tick are remembered.',
    );
  });

  it('separates "this pack holds nothing" from "no help exists"', () => {
    expect(copy.RECOVER_NO_MATCH_TITLE).toBe('This pack holds nothing for that need.');
    expect(copy.RECOVER_NO_MATCH_LINE).toBe(
      'Help may still exist. Try the official channel with a connection.',
    );
    expect(copy.RECOVER_NONE_TITLE).toBe('No support information is held on this phone.');
  });

  it('offers needs in everyday words, never a program, agency or scheme name', () => {
    for (const phrase of Object.values(copy.NEED_PHRASE)) {
      expect(phrase).not.toMatch(/payment|allowance|grant|australia|scheme|program/i);
    }
  });
});

// E5-US1-AC4 — the four states of the rehearsal entry gate. Each one names what
// is missing from the PACK. None of them describes the reader, and none of them
// reports an unspecified problem, so each is asserted here by exact match.
describe('the rehearsal entry gate', () => {
  // The heading is the first thing on the card. An earlier draft put a line
  // above it saying a rehearsal could not start, which said what the heading
  // said one line before the heading said it.
  it('the way back to the pack is offered in the reader\'s own terms', () => {
    expect(copy.BACK_TO_THIS_PACK).toBe('Back to this pack');
  });

  it('an unfinished build is described as a build that stopped', () => {
    expect(copy.PACK_NOT_FINISHED).toBe('This pack was not finished');
    expect(copy.PACK_NOT_FINISHED_DETAIL(1)).toBe(
      'A pack build did not finish, so nothing was stored for it.',
    );
    expect(copy.PACK_NOT_FINISHED_NEXT).toBe('Build it again with a connection to rehearse it.');
  });

  // One pack now carries more than one hazard, so this line names none of them.
  it('an empty pack names both of the things it does not hold, and no hazard by name', () => {
    expect(copy.NOTHING_TO_REHEARSE).toBe('This pack holds nothing to rehearse');
    expect(copy.NOTHING_TO_REHEARSE_DETAIL('Kalorama', '3 March 2026')).not.toMatch(
      /bushfire|heat|flood/i,
    );
    expect(copy.NOTHING_TO_REHEARSE_DETAIL('Kalorama', '3 March 2026')).toBe(
      'Kalorama, saved 3 March 2026, has no area designation and no official place.',
    );
  });

  // The two states differ by heading and by every sentence under it. Neither
  // explains the other: an earlier draft carried a middle paragraph correcting
  // a confusion the reader had not had.
  it('a pack that cannot be read says so, and names what would restore it', () => {
    expect(copy.PACK_COULD_NOT_BE_READ).toBe('This pack could not be read');
    expect(copy.PACK_COULD_NOT_BE_READ_NEXT).toBe('A new pack for this address would restore it.');
    expect(copy.PACK_STORE_UNREADABLE_DETAIL).toBe('The packs on this phone could not be opened.');
  });

  it('every withheld part has a name of its own', () => {
    expect(copy.UNREADABLE_PART_NAMES['stored-items']).toBe('the stored information items');
    expect(copy.UNREADABLE_PART_NAMES['saved-places']).toBe('the saved places');
    expect(copy.UNREADABLE_PART_NAMES['the-whole-pack']).toBe('the whole pack');
  });

  it('a device with no pack is offered one, and is never told it has none when it has one', () => {
    expect(copy.NO_PACK_TO_REHEARSE).toBe('No pack saved yet');
    expect(copy.NO_PACK_ELSEWHERE).toBe('That pack is not on this phone');
    expect(copy.NO_PACK_TO_REHEARSE_DETAIL).toBe('A rehearsal runs from a saved pack.');
  });
});

// E5-US1-AC1 — the two conditions a rehearsal can run under. Both are stated as
// what is missing, then what that means when it is, and neither is ranked.
describe('the choice of condition', () => {
  it('names what the rehearsal is run without', () => {
    expect(copy.CHOOSE_CONDITION_HEADING).toBe('Rehearse without…');
  });

  it('states each condition in plain words rather than as a technical state', () => {
    expect(copy.CONDITION_NO_DATA).toBe('No mobile data');
    expect(copy.CONDITION_NO_DATA_DETAIL).toBe('Only what is saved on the phone works.');
    expect(copy.CONDITION_NO_FIX).toBe('No location fix');
    expect(copy.CONDITION_NO_FIX_DETAIL).toBe('The phone cannot tell where it is.');
  });

  it('names the way out of a rehearsal', () => {
    expect(copy.LEAVE_REHEARSAL).toBe('Leave the rehearsal');
  });
});

describe('an age of one day', () => {
  it('reads "1 day ago", never "1 days ago", wherever an age is stated', () => {
    expect(copy.SAVED_DAYS_AGO(1)).toBe('Saved 1 day ago');
    expect(copy.ITEM_DAYS_AGO(1)).toBe('1 day ago');
    expect(copy.CHECKED_DAYS_AGO(1)).toBe('Checked 1 day ago');
    expect(copy.SAVED_DAYS_AGO(2)).toBe('Saved 2 days ago');
  });
});

// BS_Enhancement-AC1 and AC2. The labels, the bar and the tag are asserted by
// exact text on the screen too; here they are pinned as written.
describe('the BlackSky dial', () => {
  it('labels the main place by where it comes from', () => {
    expect(copy.YOUR_CHOSEN_PLACE).toBe('YOUR CHOSEN PLACE');
    expect(copy.NEAREST_PLACE_OF_LAST_RESORT).toBe('NEAREST PLACE OF LAST RESORT');
    expect(copy.PLACE_OF_LAST_RESORT).toBe('PLACE OF LAST RESORT');
  });

  it('gives the dial the same three facts in words', () => {
    expect(copy.DIAL_DESCRIPTION('Community Hall', '2.60 km', 'North-east')).toBe(
      'Community Hall, 2.60 km, North-east',
    );
  });

  it('folds the other places into one line: the count, and the range nearest to furthest', () => {
    expect(copy.OTHER_PLACES(['850 m'])).toBe('1 other place · 850 m');
    expect(copy.OTHER_PLACES(['12.1 km', '13.1 km'])).toBe('2 other places · 12.1 km – 13.1 km');
    expect(copy.OTHER_PLACES(['850 m', '2.13 km', '4.09 km', '12.3 km'])).toBe(
      '4 other places · 850 m – 12.3 km',
    );
    // Two places the same distance away are one figure, not a range of nothing.
    expect(copy.OTHER_PLACES(['2.13 km', '2.13 km'])).toBe('2 other places · 2.13 km');
    expect(copy.OTHER_PLACES_COUNT(1)).toBe('1 other place');
    expect(copy.OTHER_PLACES_COUNT(3)).toBe('3 other places');
  });

  it('names each Show button by its place, starting with the visible word', () => {
    expect(copy.SHOW_PLACE).toBe('Show');
    expect(copy.SHOW_PLACE_NAMED('Community Hall')).toBe('Show Community Hall');
  });

  it('says plainly that the signal is lost, with the age in seconds and then minutes', () => {
    expect(copy.GPS_SIGNAL_LOST).toBe('GPS signal lost');
    expect(copy.LAST_POSITION_AGE(35)).toBe('last position 35 s ago');
    expect(copy.LAST_POSITION_AGE(59)).toBe('last position 59 s ago');
    expect(copy.LAST_POSITION_AGE(60)).toBe('last position 1 min ago');
    expect(copy.LAST_POSITION_AGE(185)).toBe('last position 3 min ago');
    expect(copy.FROM_YOUR_SAVED_PLACE).toBe('from your saved place');
    expect(copy.ABOUT).toBe('about');
  });

  it('tags a dial that nothing is turning, and never names a sensor', () => {
    expect(copy.NORTH_UP).toBe('North up');
    const written = [copy.NORTH_UP, copy.GPS_SIGNAL_LOST, copy.TURN_ON_COMPASS].join(' ');
    expect(written).not.toMatch(/unsure|magnetometer|gyroscope|accelerometer/i);
  });
});

// BS_Enhancement-AC3. Everything the phone speaks, pinned as written: the
// caption shows these same words, and none of them tells the person where to go.
describe('the BlackSky voice', () => {
  it('says distances in words a voice reads well', () => {
    expect(copy.spokenDistance(4)).toBe('10 metres');
    expect(copy.spokenDistance(96)).toBe('100 metres');
    expect(copy.spokenDistance(500)).toBe('500 metres');
    expect(copy.spokenDistance(994)).toBe('990 metres');
    expect(copy.spokenDistance(995)).toBe('1 kilometre');
    expect(copy.spokenDistance(1_049)).toBe('1 kilometre');
    expect(copy.spokenDistance(1_960)).toBe('2 kilometres');
    expect(copy.spokenDistance(12_140)).toBe('12.1 kilometres');
  });

  it('says where the place is, never what to do about it', () => {
    expect(copy.SPOKEN_SIDES).toEqual({
      ahead: 'Ahead of you',
      right: 'On your right',
      behind: 'Behind you',
      left: 'On your left',
    });
    const everything = [
      ...Object.values(copy.SPOKEN_SIDES),
      copy.VOICE_LONG('Community Hall', copy.VOICE_SHORT('500 metres', 'North', 'On your left', true)),
      copy.VOICE_SIGNAL_LOST,
      copy.VOICE_SIGNAL_BACK(''),
      copy.VOICE_AT_PLACE('Community Hall', 50),
    ].join(' ');
    expect(everything).not.toMatch(/\b(turn|go|head|drive|walk|travel|continue|keep|take|follow)\b/i);
  });

  it('builds the short form, the long form and the three one-off messages', () => {
    expect(copy.VOICE_SHORT('12.1 kilometres', 'North-east', 'On your right', false)).toBe(
      '12.1 kilometres. North-east. On your right.',
    );
    expect(copy.VOICE_SHORT('500 metres', 'South', null, true)).toBe('About 500 metres. South.');
    expect(copy.VOICE_LONG('Community Hall', '500 metres. South.')).toBe(
      'Community Hall, place of last resort. 500 metres. South.',
    );
    expect(copy.VOICE_SIGNAL_LOST).toBe('GPS signal lost.');
    expect(copy.VOICE_SIGNAL_BACK('500 metres. South.')).toBe('GPS signal is back. 500 metres. South.');
    expect(copy.VOICE_AT_PLACE('Community Hall', 50)).toBe('Community Hall is within 50 metres.');
    expect(copy.VOICE_BUTTON).toBe('Speak the distance aloud');
  });
});
