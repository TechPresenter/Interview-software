'use client';

/**
 * Text-to-speech helper that prefers a professional Indian female voice and
 * supports English (en-IN) and Hindi (hi-IN). Falls back gracefully to whatever
 * the browser/OS provides.
 */

export type Lang = 'en' | 'hi';

let cached: SpeechSynthesisVoice[] = [];

// Server-TTS (Sarvam) playback state — kept module-level so stopSpeaking() can
// interrupt an in-flight audio sequence just like it cancels speechSynthesis.
let currentAudio: HTMLAudioElement | null = null;
let remoteCancelled = false;

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

export type VoicePref = 'female' | 'male' | 'auto';

// Known Indian voice-name hints across Windows / Chrome / Edge.
const FEMALE_HINTS = /(heera|kalpana|swara|neerja|aditi|raveena|female|woman|priya|ananya|google.*हिन्दी|google.*india)/i;
const MALE_HINTS = /(male|man|ravi|hemant|prabhat|madhur|google.*male)/i;

/** Pick the best voice for a language, preferring Indian + the requested gender. */
export function pickVoice(lang: Lang, voices = cached, prefer: VoicePref = 'female'): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  const target = lang === 'hi' ? 'hi' : 'en';
  const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(target));
  const indian = inLang.filter((v) => /in/i.test(v.lang)); // en-IN / hi-IN
  if (prefer === 'auto') {
    for (const pool of [indian, inLang, voices]) if (pool.length) return pool[0];
    return voices[0];
  }
  const hint = prefer === 'male' ? MALE_HINTS : FEMALE_HINTS;
  const pools = [
    indian.filter((v) => hint.test(v.name)),
    indian,
    inLang.filter((v) => hint.test(v.name)),
    inLang,
    voices.filter((v) => hint.test(v.name)),
  ];
  for (const pool of pools) if (pool.length) return pool[0];
  return voices[0];
}

/** Speak text in the given language + voice preference. */
export function speak(
  text: string,
  lang: Lang,
  { onStart, onEnd, voice = 'female' }: { onStart?: () => void; onEnd?: () => void; voice?: VoicePref } = {},
) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(lang, cached, voice);
  if (v) u.voice = v;
  u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  u.rate = lang === 'hi' ? 0.95 : 1;
  u.pitch = voice === 'male' ? 0.9 : 1.05;
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

/**
 * Play a sequence of base64 audio chunks (from server-side Sarvam TTS) in order.
 * Resolves when playback finishes or is interrupted by stopSpeaking().
 */
export async function playAudios(
  audios: string[],
  mime = 'audio/wav',
  { onStart, onEnd }: { onStart?: () => void; onEnd?: () => void } = {},
): Promise<void> {
  stopSpeaking();
  remoteCancelled = false;
  if (typeof window === 'undefined' || !audios?.length) {
    onEnd?.();
    return;
  }
  onStart?.();
  try {
    for (const b64 of audios) {
      if (remoteCancelled) break;
      await new Promise<void>((resolve) => {
        const audio = new Audio(`data:${mime};base64,${b64}`);
        currentAudio = audio;
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    }
  } finally {
    currentAudio = null;
    onEnd?.();
  }
}

export function stopSpeaking() {
  remoteCancelled = true;
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}
