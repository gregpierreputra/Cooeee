import { describe, expect, it } from 'vitest';
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
    expect(copy.NO_ADDRESS_MATCH).toBe(
      'No matching address found. Check the spelling or try the nearest cross street.',
    );
    expect(copy.NO_ADDRESS_MATCH).not.toContain('\u2014');
    expect(copy.NO_ADDRESS_MATCH).not.toContain('-');
  });

  it('no fix falls back to saved information, in words', () => {
    expect(copy.NO_GPS).toBe('No GPS fix. Showing your saved information.');
  });

  it('a vague or old fix reports its own figure beside the arrow, never instead of it', () => {
    expect(copy.GPS_APPROXIMATE(240)).toBe(
      'GPS is only accurate to ± 240 m here. The direction is approximate and sharpens as the fix improves.',
    );
    expect(copy.FIX_AGE(45)).toBe('Last GPS fix 45 s ago. The direction may have changed.');
  });

  it("being outside the loaded pack's area is stated plainly", () => {
    expect(copy.OUTSIDE_AREAS).toBe("You're outside this pack's area");
  });

  it('a stale pack is labelled without being disabled', () => {
    expect(copy.NOT_RECENTLY_VERIFIED(96)).toBe('Saved 96 days ago, not recently verified');
  });

  it('the app states what it cannot detect', () => {
    expect(copy.PHONE_MAY_WORK).toBe(
      'Phone calls may work if your phone shows signal. This app cannot detect phone signal.',
    );
  });
});

describe('composed lines', () => {
  it('a fresh pack is dated without a verdict attached', () => {
    expect(copy.SAVED_DAYS_AGO(3)).toBe('Saved 3 days ago');
  });

  it('the choose hint pluralises for one place versus two', () => {
    expect(copy.CHOOSE_PLACES_HINT(1)).toBe('Choose the place to save.');
    expect(copy.CHOOSE_PLACES_HINT(2)).toBe('Choose two places to save.');
  });
});

describe('shell copy', () => {
  it('states an update is waiting and that nothing changes until the user chooses', () => {
    expect(copy.NEW_VERSION_READY).toContain('Nothing changes until then');
  });

  it('says a pack is missing without implying anything about the place', () => {
    expect(copy.NO_PACKS_HINT).toContain('while you have a connection');
  });
});

describe('E1-US2 mandated provenance and offline-source copy', () => {
  it('states why one item was omitted and the storage rule behind it', () => {
    expect(copy.ITEM_LEFT_OUT).toBe('One item was left out of your pack.');
    expect(copy.ITEM_LEFT_OUT_REASON).toBe(
      'It did not name who published it or when it was published, so it was not saved.',
    );
    expect(copy.PROVENANCE_STORAGE_RULE).toBe(
      'Cooeee only stores information it can show you the source for.',
    );
    expect(copy.ITEMS_LEFT_OUT(2)).toBe('2 items were left out of your pack.');
  });

  it('states what an offline source tap cannot do and what remains local', () => {
    expect(copy.SOURCE_IS_ON_WEB).toBe(
      'This source is on the web.',
    );
    expect(copy.STORED_PROVENANCE_REMAINS).toBe(
      'The publisher and the saved date below are stored on this device and stay readable.',
    );
    expect(copy.EXTERNAL_SOURCE_NOTICE).toBe(
      'Opening it may use your connection and leave Cooeee.',
    );
    expect(copy.CONTINUE_TO_ORIGINAL_SOURCE).toBe('Continue to original source (web)');
    // Both labels lead to the publisher's page for the dataset; neither promises
    // a statement of this one result on the far end.
    expect(copy.CONTINUE_TO_DATASET_PAGE).toBe("Continue to the publisher's dataset page (web)");
  });

  it('formats the shared publisher and saved date line exactly', () => {
    expect(copy.PROVENANCE_LINE('Department of Transport and Planning', '3 March 2026')).toBe(
      'Published by Department of Transport and Planning · Saved 3 March 2026',
    );
  });
});

// The eyebrows are stored sentence case and rendered uppercase by .kicker. The
// casing is an accessibility decision — an all-caps string in the DOM is spelled
// out letter by letter by some screen readers — so it is asserted here rather
// than left to whoever next edits the file.
describe('screen eyebrows', () => {
  it('names the step of the flow, one label per screen', () => {
    expect(copy.EYEBROW_SET_UP_YOUR_PLACE).toBe('Set up your place');
    expect(copy.EYEBROW_CONFIRM_ADDRESS).toBe('Confirm address');
    expect(copy.EYEBROW_AREA_RESULT).toBe('Area result');
    expect(copy.EYEBROW_SAVE_YOUR_PACK).toBe('Save your pack');
    expect(copy.EYEBROW_MY_PACK).toBe('My pack');
  });

  it('stores sentence case, so the capitals stay a visual transform', () => {
    for (const eyebrow of [
      copy.EYEBROW_SET_UP_YOUR_PLACE,
      copy.EYEBROW_CONFIRM_ADDRESS,
      copy.EYEBROW_AREA_RESULT,
      copy.EYEBROW_SAVE_YOUR_PACK,
      copy.EYEBROW_MY_PACK,
    ]) {
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

  it('shows metres under a kilometre and one decimal above', () => {
    expect(copy.distanceLabel(850)).toBe('850 m');
    expect(copy.distanceLabel(999.4)).toBe('999 m');
    expect(copy.distanceLabel(1120)).toBe('1.1 km');
    expect(copy.distanceLabel(2700)).toBe('2.7 km');
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
    expect(copy.ESTIMATE_READOUT(53)).toBe(
      'ESTIMATE from your marked position, ± 53 m and growing',
    );
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
  it('asks which pack to load, and says the nearest places are pointed at regardless', () => {
    expect(copy.CHOOSE_PACK).toBe('Choose a pack to load');
    expect(copy.CHOOSE_PACK_HINT).toBe(
      'Its places, notes and reminder load once it is chosen. The nearest official places of last resort are pointed at from your position regardless.',
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

  it('leaving the mode is one plainly named action', () => {
    expect(copy.LEAVE_BLACKSKY).toBe('Leave BlackSky');
  });

  it('a back press and a return both name the one way out', () => {
    expect(copy.BACK_PRESSED).toBe(
      'You pressed back. BlackSky stays until you hold Leave BlackSky for two seconds.',
    );
    expect(copy.BLACKSKY_RESUMED).toBe(
      'BlackSky was open when you last left Cooeee, so it opened again. To leave, hold Leave BlackSky for two seconds.',
    );
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
    expect(copy.NO_PACK_SAVED).toBe('No pack is saved on this device.');
    expect(copy.BUILD_A_PACK).toBe('Build an offline pack');
  });

  it('labels the preparation line as a daily reminder', () => {
    expect(copy.PREPARATION_LABEL).toBe("Today's reminder");
  });

  it('tours ten features across every screen, three led lines each', () => {
    expect(copy.TOUR_STEPS.map((step) => step.title)).toEqual([
      "Today's reminder",
      'Your saved packs',
      'Build an offline pack',
      'Hold for BlackSky',
      'The header',
      'The bottom bar',
      'The address search',
      'Nearby official places',
      'Recover',
      'About Cooeee',
    ]);
    for (const step of copy.TOUR_STEPS) {
      expect(step.path.startsWith('/')).toBe(true);
      expect(step.lines).toHaveLength(copy.TOUR_LEADS.length);
    }
    expect(copy.SKIP_TOUR).toBe('Skip tour');
  });

  it('says what Cooeee is on the About page, in plain sentences with no colon, semicolon or dash', () => {
    expect(copy.ABOUT_COOEEE).toBe('About Cooeee');
    expect(copy.COOEEE_INFO_LINES.map((line) => line.lead)).toEqual([
      'What it is.',
      'Why it exists.',
      'What it does.',
      'What it does not do.',
      'Where your information stays.',
    ]);
    for (const line of copy.COOEEE_INFO_LINES) {
      expect(`${line.lead} ${line.text}`).not.toMatch(/[:;\u2013\u2014-]/);
    }
  });

  it('says what BlackSky is and why, then three facts about using it', () => {
    expect(copy.ABOUT_BLACKSKY).toBe('About BlackSky');
    expect(copy.BLACKSKY_INFO_LINES.map((line) => line.lead)).toEqual([
      'What it is.',
      'Why it exists.',
      'Works with no signal.',
      'Points the way.',
      'Two seconds to enter, two to leave.',
    ]);
  });

  it('credits the guidance behind the preparation line, without quoting it', () => {
    expect(copy.PREPARATION_SOURCE).toBe('Based on Country Fire Authority guidance.');
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
    expect(copy.RECOVER_ORDER_LINE).toBe('Listed by organisation name, in alphabetical order.');
  });

  it('says what is shared, and that the caveat travels with a shared list', () => {
    expect(copy.SHARED_FROM).toBe('Shared from Cooeee. Programs change, and the organisation decides.');
    expect(copy.RECOVER_ORDER_LINE_KEPT).toBe('Kept programs first, then by organisation name.');
    expect(copy.PREPARATION_LINES.filter((line) => line.source === copy.PREPARATION_SOURCE_RECOVERY)).toHaveLength(2);
  });

  it('names the saved programs section, its one control and the Home nudge', () => {
    expect(copy.SAVED_PROGRAMS).toBe('Saved programs');
    expect(copy.SHOW).toBe('Show');
    expect(copy.HIDE).toBe('Hide');
    expect(copy.SHOW_SECTION('Saved programs')).toBe('Show Saved programs');
    expect(copy.HIDE_SECTION('Notes')).toBe('Hide Notes');
    expect(copy.STORED_INFORMATION).toBe('Stored information');
    expect(copy.NUDGE_KICKER).toBe('Not yet offline');
    expect(copy.KEPT_NOT_SAVED(1)).toBe('1 kept program is not yet in an offline pack.');
    expect(copy.KEPT_NOT_SAVED(2)).toBe('2 kept programs are not yet in an offline pack.');
    expect(copy.KEPT_NOT_SAVED_LINE).toBe('Build a pack to carry their pages, so they open with no signal.');
  });

  it('states that nothing chosen leaves the phone', () => {
    expect(copy.RECOVER_PRIVACY_LINE).toBe(
      'Nothing you choose here leaves this phone. Only a program you keep is remembered, on this phone.',
    );
  });

  it('separates "this pack holds nothing" from "no help exists"', () => {
    expect(copy.RECOVER_NO_MATCH_TITLE).toBe('This pack holds nothing for that need.');
    expect(copy.RECOVER_NO_MATCH_LINE).toBe(
      'That is not the same as no help existing. Try the official channel when you have a connection.',
    );
    expect(copy.RECOVER_NONE_TITLE).toBe('No support information is held on this phone.');
  });

  it('offers needs in everyday words, never a program, agency or scheme name', () => {
    for (const phrase of Object.values(copy.NEED_PHRASE)) {
      expect(phrase).not.toMatch(/payment|allowance|grant|australia|scheme|program/i);
    }
  });
});
