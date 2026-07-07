import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { getGroup } from './settings.service.js';

/**
 * Text-to-speech via Sarvam AI — natural Indian-language voices (Hindi/English)
 * for the live interview room. The API key stays server-side; the browser only
 * receives ready-to-play base64 WAV audio. Returns null when Sarvam is not
 * configured or the request fails, so callers can fall back to browser TTS.
 *
 * Configuration is resolved from the Admin Panel ("voice" settings group) first,
 * falling back to env (config.voice.sarvam). Cached briefly so edits apply fast.
 *
 * @see https://docs.sarvam.ai/ — POST /text-to-speech (bulbul model)
 */

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';
const MAX_CHARS = 900; // safe per-input character budget for bulbul
const MAX_CHUNKS = 6; // bound latency/cost of a single synthesis request

let _cache = null;
let _at = 0;
const CACHE_TTL = 30000; // 30s

/** Merge admin-panel voice settings over env defaults (cached). */
export async function resolveVoice() {
  if (_cache && Date.now() - _at < CACHE_TTL) return _cache;
  let db = {};
  try {
    const rows = await getGroup('voice', { unmask: true });
    db = Object.fromEntries((rows || []).map((r) => [r.key.replace('voice.', ''), r.value]));
  } catch {
    /* settings unavailable — fall back to env */
  }
  const envc = config.voice.sarvam;
  const provider = db.provider || (envc.enabled ? 'sarvam' : 'browser');
  const apiKey = db.sarvamApiKey || envc.apiKey;
  const paceNum = Number(db.pace);
  _cache = {
    provider,
    apiKey,
    model: db.model || envc.model,
    speakerFemale: db.speakerFemale || envc.speakerFemale,
    speakerMale: db.speakerMale || envc.speakerMale,
    pace: Number.isFinite(paceNum) && paceNum > 0 ? paceNum : null,
    enabled: provider === 'sarvam' && Boolean(apiKey),
  };
  _at = Date.now();
  return _cache;
}

/** Invalidate the cached voice config after an admin settings change. */
export function refreshVoice() {
  _cache = null;
  _at = 0;
}

/** True when Sarvam TTS is usable (provider=sarvam + a key present). */
export async function ttsEnabled() {
  return (await resolveVoice()).enabled;
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
  const cfg = await resolveVoice();
  if (!cfg.enabled) return null;

  const inputs = chunk(text);
  if (!inputs.length) return null;

  const speaker = gender === 'male' ? cfg.speakerMale : cfg.speakerFemale;
  const targetLanguageCode = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const pace = cfg.pace != null ? cfg.pace : lang === 'hi' ? 0.95 : 1;

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
        pace,
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
