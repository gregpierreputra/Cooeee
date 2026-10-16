import { describe, expect, it } from 'vitest';

import { backTarget, drillHome, ONE_STEP } from '../../src/core/back';

const NONE = { runPackId: null, builder: 'step' } as const;

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

  it("goes from a need opened by a pack's Save more back to that pack's Support tab", () => {
    expect(backTarget('/recover', '?need=all&from=pack-1', NONE)).toBe('/packs/pack-1?tab=support');
    // The list of needs is still the tab itself, with no Back.
    expect(backTarget('/recover', '?from=pack-1', NONE)).toBeNull();
  });

  it.each(['/packs/new', '/packs/some-pack', '/no-such-screen'])('goes from %s up to Home', (path) => {
    expect(backTarget(path, '', NONE)).toBe('/');
  });

  it('goes from a pack\'s rehearsal up to Rehearse, which always lists the packs', () => {
    expect(backTarget('/rehearse/a', '', NONE)).toBe('/rehearse');
  });

  it('goes from a pack\'s rehearsal back to the pack\'s Practice tab when the pack page opened it', () => {
    expect(backTarget('/rehearse/a', '?from=pack', NONE)).toBe('/packs/a?tab=practice');
  });

  it('goes from a chosen condition back to the choice, keeping where it was opened from', () => {
    expect(backTarget('/rehearse/a', '?condition=no-data', NONE)).toBe('/rehearse/a');
    expect(backTarget('/rehearse/a', '?from=pack&condition=no-data', NONE)).toBe('/rehearse/a?from=pack');
  });

  it.each(['/rehearse/drill', '/rehearse/word', '/rehearse/block'])('goes from the game %s up to Rehearse, whatever is running', (path) => {
    expect(backTarget(path, '', NONE)).toBe('/rehearse');
    expect(backTarget(path, '', { ...NONE, runPackId: 'a' })).toBe('/rehearse');
  });

  it("goes from the drill opened on a pack's Practice tab back to that tab, by Back and by Done", () => {
    expect(backTarget('/rehearse/drill', '?from=pack-1', NONE)).toBe('/packs/pack-1?tab=practice');
    expect(drillHome('?from=pack-1')).toBe('/packs/pack-1?tab=practice');
    expect(drillHome('')).toBe('/rehearse');
  });

  it('goes from a pack\'s print page back to the pack, on the tab it was opened from, when the pack page opened it, else Home', () => {
    expect(backTarget('/packs/a/print', '?from=pack', NONE)).toBe('/packs/a?tab=area');
    // Back to the tab it was opened from.
    expect(backTarget('/packs/a/print', '?from=pack&tab=places', NONE)).toBe('/packs/a?tab=places');
    expect(backTarget('/packs/a/print', '', NONE)).toBe('/');
  });

  it('hides Back on a rehearsal while one is running, as Rehearse opens it again', () => {
    expect(backTarget('/rehearse/a', '', { ...NONE, runPackId: 'a' })).toBeNull();
  });

  it('steps back one step inside the pack builder, and hides while busy or once saved', () => {
    expect(backTarget('/packs/new', '?step=note', NONE)).toBe(ONE_STEP);
    expect(backTarget('/packs/new', '?step=area', { ...NONE, builder: 'hidden' })).toBeNull();
    expect(backTarget('/packs/new', '', NONE)).toBe('/');
    expect(backTarget('/packs/new', '?from=rehearse', NONE)).toBe('/rehearse');
    expect(backTarget('/packs/new', '?from=recover', NONE)).toBe('/recover');
    expect(backTarget('/packs/new', '?from=elsewhere', NONE)).toBe('/');
    expect(backTarget('/packs/new', '?from=rehearse&step=note', NONE)).toBe(ONE_STEP);
  });
});
