import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Text-to-speech via Sarvam AI — natural Indian-language voices (Hindi/English)
 * for the live interview room. The API key stays server-side; the browser only
 * receives ready-to-play base64 WAV audio. Returns null when Sarvam is not
 * configured or the request fails, so callers can fall back to browser TTS.
 *
 * @see https://docs.sarvam.ai/ — POST /text-to-speech (bulbul model)
 */

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';
const MAX_CHARS = 900; // safe per-input character budget for bulbul
const MAX_CHUNKS = 6; // bound latency/cost of a single synthesis request

/** True when a Sarvam API key is configured. */
export function ttsEnabled() {
  return Boolean(config.voice.sarvam.enabled);
}

/** Split text into sentence-ish chunks, each under MAX_CHARS (handles the "।" danda). */
function chunk(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= MAX_CHARS) return [clean];
  const sentences = clean.match(/[^.!?।]+[.!?।]?/g) || [clean];
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && (buf + s).length > MAX_CHARS) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
    if (out.length >= MAX_CHUNKS) break;
  }
  if (buf && out.length < MAX_CHUNKS) out.push(buf.trim());
  return out.slice(0, MAX_CHUNKS);
}

/**
 * Synthesize speech with Sarvam's bulbul TTS.
 * @param {{ text:string, lang?:'en'|'hi', gender?:'female'|'male'|'auto' }} opts
 * @returns {Promise<{ audios:string[], mime:string }|null>} base64 WAV chunks in order, or null.
 */
export async function synthesize({ text, lang = 'en', gender = 'female' }) {
  const cfg = config.voice.sarvam;
  if (!cfg.enabled) return null;

  const inputs = chunk(text);
  if (!inputs.length) return null;

  const speaker = gender === 'male' ? cfg.speakerMale : cfg.speakerFemale;
  const targetLanguageCode = lang === 'hi' ? 'hi-IN' : 'en-IN';

  try {
    const res = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': cfg.apiKey,
      },
      body: JSON.stringify({
        inputs,
        target_language_code: targetLanguageCode,
        speaker,
        model: cfg.model,
        pitch: 0,
        pace: lang === 'hi' ? 0.95 : 1,
        loudness: 1,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn({ status: res.status, body: body.slice(0, 300) }, 'Sarvam TTS request failed');
      return null;
    }

    const data = await res.json();
    const audios = Array.isArray(data?.audios) ? data.audios.filter(Boolean) : [];
    if (!audios.length) return null;
    return { audios, mime: 'audio/wav' };
  } catch (err) {
    logger.warn({ err: err.message }, 'Sarvam TTS error');
    return null;
  }
}

export default synthesize;
