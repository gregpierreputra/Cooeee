import type { ConnState } from './types';

/**
 * What is observable: whether a network interface exists (navigator.onLine), and
 * whether a fetch probe reached the origin.
 *
 * What is NOT observable: cellular registration, signal bars, whether a call
 * would connect, whether an SMS would be delivered. Mobile data switched off
 * with five bars of reception reports EXACTLY the same as airplane mode.
 *
 * So the app never emits the words "no service". It says what it can see, and
 * says plainly what it cannot. probeOk === null means the probe has not answered
 * yet, which is not evidence the internet is reachable.
 */
export const classify = (onLine: boolean, probeOk: boolean | null): ConnState =>
  !onLine ? 'offline' : probeOk ? 'online' : 'no-data';
