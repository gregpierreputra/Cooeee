import { type FlagStore, readFlag, writeFlag } from './acknowledgement';
import { GATE_KEY, GATE_VALUE } from './constants';

/** Feature 1: whether this device has already passed the development gate. */
export function readGate(store: FlagStore | null): boolean {
  return readFlag(store, GATE_KEY, GATE_VALUE);
}

export function writeGate(store: FlagStore | null): boolean {
  return writeFlag(store, GATE_KEY, GATE_VALUE);
}
