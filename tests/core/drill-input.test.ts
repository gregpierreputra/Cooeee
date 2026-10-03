import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachKeys } from '../../src/ui/Drill/input';

// The tests run under Node: a bare EventTarget stands in for the window.
const key = (type: 'keydown' | 'keyup', name: string) => Object.assign(new Event(type), { key: name });

describe('the drill keys', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('steers with WASD in either case, and a letter let go under Shift still stops', () => {
    vi.stubGlobal('window', new EventTarget());
    const steer = vi.fn();
    const detach = attachKeys(steer);
    window.dispatchEvent(key('keydown', 'd'));
    expect(steer).toHaveBeenLastCalledWith(1, 0);
    window.dispatchEvent(key('keyup', 'D')); // Shift went down before the key came up
    expect(steer).toHaveBeenLastCalledWith(0, 0);
    window.dispatchEvent(key('keydown', 'W')); // Caps Lock
    expect(steer).toHaveBeenLastCalledWith(0, -1);
    detach();
  });
});
