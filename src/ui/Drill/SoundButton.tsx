import * as copy from '../../core/copy';
import * as audio from './audio';

/** E7-US4-AC2 — one round button that shows the state it is in: a speaker
 *  with sound waves, filled, while sound is on; a speaker with a cross,
 *  outlined, while it is off. A screen reader hears "Sound" and whether it
 *  is pressed. */
export default function SoundButton() {
  const muted = audio.useMuted();
  return (
    <button
      type="button"
      className={muted ? 'drill-sound off' : 'drill-sound on'}
      aria-label={copy.SOUND}
      aria-pressed={!muted}
      title={muted ? copy.SOUND_OFF : copy.SOUND_ON}
      onClick={audio.toggleMuted}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />}
      </svg>
    </button>
  );
}
