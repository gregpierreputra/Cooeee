import { describe, expect, it } from 'vitest';
import {
  openingScreen,
  readAcknowledgement,
  writeAcknowledgement,
  type FlagStore,
} from '../../src/core/acknowledgement';
import { ACKNOWLEDGEMENT_KEY, ACKNOWLEDGEMENT_VALUE } from '../../src/core/constants';

/** An in-memory stand-in for browser storage. No browser is needed to test the
 *  rule, which is the whole reason the store is a parameter. */
function memoryStore(seed?: Record<string, string>): FlagStore {
  const values = new Map(Object.entries(seed ?? {}));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const throwingStore: FlagStore = {
  getItem: () => {
    throw new DOMException('site data is blocked');
  },
  setItem: () => {
    throw new DOMException('site data is blocked');
  },
};

describe('reading the acknowledgement flag', () => {
  it('a device with nothing stored has not acknowledged', () => {
    expect(readAcknowledgement(memoryStore())).toBe(false);
  });

  it('the exact marker written by this version reads as acknowledged', () => {
    expect(readAcknowledgement(memoryStore({ [ACKNOWLEDGEMENT_KEY]: ACKNOWLEDGEMENT_VALUE })))
      .toBe(true);
  });

  it('an unexpected value is not an acknowledgement', () => {
    expect(readAcknowledgement(memoryStore({ [ACKNOWLEDGEMENT_KEY]: 'true' }))).toBe(false);
    expect(readAcknowledgement(memoryStore({ [ACKNOWLEDGEMENT_KEY]: '' }))).toBe(false);
    expect(readAcknowledgement(memoryStore({ [ACKNOWLEDGEMENT_KEY]: 'ACKNOWLEDGED' }))).toBe(false);
  });

  it('a value under another key is not an acknowledgement', () => {
    expect(readAcknowledgement(memoryStore({ acknowledged: ACKNOWLEDGEMENT_VALUE }))).toBe(false);
  });

  it('a store that throws on read is treated as not acknowledged, never as an error', () => {
    expect(readAcknowledgement(throwingStore)).toBe(false);
  });

  it('an absent store is treated as not acknowledged', () => {
    expect(readAcknowledgement(null)).toBe(false);
  });
});

describe('writing the acknowledgement flag', () => {
  it('records the marker and nothing else — no date, identifier or counter', () => {
    const written: Array<[string, string]> = [];
    const store: FlagStore = {
      getItem: () => ACKNOWLEDGEMENT_VALUE,
      setItem: (key, value) => {
        written.push([key, value]);
      },
    };
    writeAcknowledgement(store);
    expect(written).toEqual([[ACKNOWLEDGEMENT_KEY, ACKNOWLEDGEMENT_VALUE]]);
  });

  it('reports true only when the flag will survive to the next open', () => {
    const store = memoryStore();
    expect(writeAcknowledgement(store)).toBe(true);
    expect(readAcknowledgement(store)).toBe(true);
  });

  it('reports false when the store refuses the write, without throwing', () => {
    expect(writeAcknowledgement(throwingStore)).toBe(false);
  });

  it('reports false when the write is silently dropped', () => {
    // Private-mode storages that accept setItem and forget it: the user is
    // still let through, but the screen is shown again next open.
    const forgetful: FlagStore = { getItem: () => null, setItem: () => {} };
    expect(writeAcknowledgement(forgetful)).toBe(false);
  });

  it('reports false for an absent store', () => {
    expect(writeAcknowledgement(null)).toBe(false);
  });
});

describe('which screen opens', () => {
  it('opens on the disclosure screen when nothing is acknowledged', () => {
    expect(openingScreen(memoryStore())).toBe('first-open');
  });

  it('opens past the disclosure screen once it is acknowledged', () => {
    expect(openingScreen(memoryStore({ [ACKNOWLEDGEMENT_KEY]: ACKNOWLEDGEMENT_VALUE })))
      .toBe('prepared');
  });

  it('opens on the disclosure screen when the flag cannot be read', () => {
    expect(openingScreen(throwingStore)).toBe('first-open');
    expect(openingScreen(null)).toBe('first-open');
  });

  it('a write followed by a read opens past the screen on the next open', () => {
    const store = memoryStore();
    writeAcknowledgement(store);
    expect(openingScreen(store)).toBe('prepared');
  });
});
