import { afterEach, describe, expect, it, vi } from 'vitest';

/** Just enough of the browser's sound to start the games' sound and see it
 *  resumed: a state the phone can set, and a count of resumes asked for. */
class FakeContext {
  static last: FakeContext;
  state: string = 'running';
  resumes = 0;
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  constructor() {
    FakeContext.last = this;
  }
  resume() {
    this.resumes++;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    return { gain: { value: 0, setTargetAtTime() {} }, connect: (node: unknown) => node };
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { connect: (node: unknown) => node, start() {} };
  }
  createBiquadFilter() {
    return { frequency: {}, connect: (node: unknown) => node };
  }
}

describe('the games sound', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // A call or the lock screen stops the sound on a phone, and a resume that
  // is not part of a tap may be refused: the next tap starts it again.
  it('starts again on a tap once the phone has stopped it, and only then', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = await import('../../src/ui/Drill/audio');
    audio.wake(); // before the Start tap, nothing to wake
    audio.unlock();
    const context = FakeContext.last;
    audio.wake();
    expect(context.resumes).toBe(0);
    for (const stopped of ['suspended', 'interrupted']) {
      context.state = stopped;
      audio.wake();
      expect(context.state).toBe('running');
    }
    expect(context.resumes).toBe(2);
  });
});
