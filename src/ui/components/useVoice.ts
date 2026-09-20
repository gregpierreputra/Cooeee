import { useCallback, useEffect, useRef, useState } from 'react';

// A voice that lives on the phone. BlackSky is for when the network is gone, so
// a voice that needs the network is no voice at all: only `localService` voices
// are considered. Australian English first, because the place names are
// Australian; then any English the phone carries.
const pickVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
  const local = voices.filter((voice) => voice.localService);
  const speaks = (lang: string) => (voice: SpeechSynthesisVoice) =>
    voice.lang.replace('_', '-').toLowerCase().startsWith(lang);
  return local.find(speaks('en-au')) ?? local.find(speaks('en')) ?? null;
};

/** Speech for BlackSky (BS_Enhancement-AC3). `available` is false when the
 *  browser has no speech API or the phone has no local English voice, and then
 *  the screen draws no speaker button at all. `caption` is exactly the words
 *  being spoken, from the moment they are asked for until speech ends, so
 *  everything said is also shown (WCAG 1.2.1).
 *
 *  `speak` is synchronous on purpose: an iPhone only lets a page talk if the
 *  first utterance starts inside the tap handler itself, so nothing here waits
 *  on a promise or a timer before calling the browser. */
export function useVoice() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  // The utterance being spoken. Held in a ref for two reasons: an utterance
  // nobody references can be collected before it ends, which loses its end
  // event; and the end of an utterance that was cut off must not clear the
  // caption of the one that replaced it.
  const speaking = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    // Some browsers have the list ready at once and never fire the event;
    // others fill it a moment later and do. Both are read.
    const read = () => setVoice(pickVoice(synth.getVoices()));
    read();
    synth.addEventListener?.('voiceschanged', read);
    return () => {
      synth.removeEventListener?.('voiceschanged', read);
      speaking.current = null;
      synth.cancel(); // Leave BlackSky mid-sentence: the sentence stops too
    };
  }, []);

  const cancel = useCallback(() => {
    speaking.current = null;
    setCaption(null);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  /** Say `text`. With `cutIn` whatever is being said stops first; without it
   *  the browser queues this behind the current sentence. */
  const speak = useCallback(
    (text: string, cutIn: boolean) => {
      if (!voice) return;
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      const done = () => {
        if (speaking.current !== utterance) return;
        speaking.current = null;
        setCaption(null);
      };
      utterance.onend = done;
      utterance.onerror = done;
      if (cutIn) synth.cancel();
      speaking.current = utterance;
      setCaption(text);
      synth.speak(utterance);
    },
    [voice],
  );

  return { available: voice !== null, caption, speak, cancel };
}
