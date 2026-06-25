'use client';

/**
 * Text-to-speech helper that prefers a professional Indian female voice and
 * supports English (en-IN) and Hindi (hi-IN). Falls back gracefully to whatever
 * the browser/OS provides.
 */

export type Lang = 'en' | 'hi';

let cached: SpeechSynthesisVoice[] = [];

/** Resolve the available voices (they load async in some browsers). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      cached = existing;
      return resolve(existing);
    }
    const handler = () => {
      cached = window.speechSynthesis.getVoices();
      resolve(cached);
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // Safety timeout
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 800);
  });
}

// Known Indian female voice names across Windows / Chrome / Edge.
const FEMALE_HINTS = /(heera|kalpana|swara|neerja|aditi|raveena|female|woman|priya|ananya|google.*हिन्दी|google.*india)/i;

/** Pick the best voice for a language, preferring Indian + female. */
export function pickVoice(lang: Lang, voices = cached): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  const target = lang === 'hi' ? 'hi' : 'en';
  const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(target));
  const indian = inLang.filter((v) => /in/i.test(v.lang)); // en-IN / hi-IN
  const pools = [
    indian.filter((v) => FEMALE_HINTS.test(v.name)),
    indian,
    inLang.filter((v) => FEMALE_HINTS.test(v.name)),
    inLang,
    voices.filter((v) => FEMALE_HINTS.test(v.name)),
  ];
  for (const pool of pools) if (pool.length) return pool[0];
  return voices[0];
}

/** Speak text in the given language. Returns when speech ends. */
export function speak(
  text: string,
  lang: Lang,
  { onStart, onEnd }: { onStart?: () => void; onEnd?: () => void } = {},
) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  u.rate = lang === 'hi' ? 0.95 : 1;
  u.pitch = 1.05;
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}
