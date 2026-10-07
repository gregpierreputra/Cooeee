import { describe, expect, it } from 'vitest';

import { backTarget, ONE_STEP } from '../../src/core/back';

const NONE = { packCount: null, runPackId: null, builder: 'step' } as const;

describe('backTarget, the screen above each screen', () => {
  it.each(['/', '/nearby', '/rehearse', '/recover'])('hides Back on the tab %s', (path) => {
    expect(backTarget(path, '', NONE)).toBeNull();
  });

  it('hides Back in BlackSky', () => {
    expect(backTarget('/blacksky', '', NONE)).toBeNull();
  });

  it('goes from a chosen need up to the list of needs', () => {
    expect(backTarget('/recover', '?need=money', NONE)).toBe('/recover');
    expect(backTarget('/recover', '?need=kept', NONE)).toBe('/recover');
  });

  it.each(['/packs/new', '/packs/some-pack', '/no-such-screen'])('goes from %s up to Home', (path) => {
    expect(backTarget(path, '', NONE)).toBe('/');
  });

  it('goes from a rehearsal up to the chooser only when several packs are saved', () => {
    expect(backTarget('/rehearse/a', '', { ...NONE, packCount: 2 })).toBe('/rehearse');
    expect(backTarget('/rehearse/a', '', { ...NONE, packCount: 1 })).toBeNull();
    expect(backTarget('/rehearse/a', '', { ...NONE, packCount: 0 })).toBeNull();
    expect(backTarget('/rehearse/a', '', NONE)).toBeNull();
  });

  it('hides Back on a rehearsal while one is running, as Rehearse opens it again', () => {
    expect(backTarget('/rehearse/a', '', { ...NONE, packCount: 3, runPackId: 'a' })).toBeNull();
  });

  it('steps back one step inside the pack builder, and hides while busy or once saved', () => {
    expect(backTarget('/packs/new', '?step=note', NONE)).toBe(ONE_STEP);
    expect(backTarget('/packs/new', '?step=area', { ...NONE, builder: 'hidden' })).toBeNull();
    expect(backTarget('/packs/new', '', NONE)).toBe('/');
  });
});
