// E7 — every sound in the drill, made by the phone itself. No sound file is
// downloaded, so there is nothing to fetch, license or precache, and the
// site's content rules stay as they are. Nothing plays before unlock(), which
// the Start button calls: browsers only allow sound from inside a tap.

import { useSyncExternalStore } from 'react';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let fireGain: GainNode | null = null;

// The mute choice lasts until the app is closed. Nothing is stored.
let muted = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useMuted = (): boolean => useSyncExternalStore(subscribe, () => muted);
export function toggleMuted(): void {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 1;
  listeners.forEach((listener) => listener());
}

/** Two seconds of noise. `sparse` leaves only scattered clicks: the crackle. */
function noise(ctx: AudioContext, sparse: boolean): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const sample = Math.random() * 2 - 1;
    data[i] = sparse ? (Math.random() < 0.002 ? sample : 0) : sample;
  }
  return buffer;
}

function loopNoise(ctx: AudioContext, sparse: boolean, filter: BiquadFilterType, frequency: number, out: AudioNode): void {
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx, sparse);
  source.loop = true;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.value = frequency;
  source.connect(biquad).connect(out);
  source.start();
}

/** Start the sound, from inside a tap. Safe to call again. */
export function unlock(): void {
  if (context) {
    void context.resume();
    return;
  }
  if (typeof AudioContext === 'undefined') return;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(context.destination);
  fireGain = context.createGain();
  fireGain.gain.value = 0;
  fireGain.connect(master);
  loopNoise(context, false, 'lowpass', 400, fireGain); // wind
  loopNoise(context, true, 'highpass', 1200, fireGain); // crackle
}

/** How loud the wind and the fire are, 0 to 1. */
export function fire(level: number): void {
  if (context && fireGain) fireGain.gain.setTargetAtTime(level * 0.5, context.currentTime, 0.3);
}

/** One short tone that falls or rises from `from` to `to` hertz. */
function tone(type: OscillatorType, from: number, to: number, seconds: number, volume: number): void {
  if (!context || !master) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, now);
  oscillator.frequency.exponentialRampToValueAtTime(to, now + seconds);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
  oscillator.connect(gain).connect(master);
  oscillator.start(now);
  oscillator.stop(now + seconds);
}

export const blip = () => tone('triangle', 520, 880, 0.12, 0.25);
export const beat = () => tone('sine', 70, 40, 0.18, 0.6);
export const thud = () => tone('sine', 110, 30, 0.4, 0.7);
export const powerDown = () => tone('sawtooth', 220, 30, 0.9, 0.2);

/** Silence while the tab is hidden or the drill is closed, and back again. */
export const suspend = () => void context?.suspend();
export const resume = () => void context?.resume();
