import { emitToCompany } from '../socket/emitters.js';

/**
 * Proctoring fraud-scoring engine.
 *
 * SCORE_WEIGHTS is the single source of truth for every anti-cheat signal — how
 * much each event type adds to the live fraud score (0–100). New detectors just
 * add an entry here (the Interview event `type` is a free string). Per-type caps
 * stop a single noisy signal (e.g. looking_away) from maxing out the score on
 * its own; the total is clamped to 100.
 */
export const SCORE_WEIGHTS = {
  // Identity / faces (§1, §2, §3)
  multiple_faces: 40,
  person_entered: 20,
  person_left: 10,
  face_missing: 15,
  no_face: 15,
  face_mismatch: 30,
  liveness_fail: 25,
  spoof_detected: 30,
  // Attention / gaze (§3, §4)
  looking_away: 5,
  head_turn: 4,
  eyes_closed: 4,
  gaze_off: 3,
  // Browser security (§5)
  dev_tools: 25,
  view_source: 20,
  paste: 12,
  copy: 6,
  cut: 6,
  right_click: 2,
  context_menu: 2,
  text_selection: 1,
  drag_drop: 3,
  print_screen: 15,
  zoom: 2,
  // Tab / window (§6)
  tab_switch: 10,
  window_blur: 6,
  window_minimize: 10,
  fullscreen_exit: 10,
  browser_switch: 15,
  multi_tab: 15,
  multi_monitor: 8,
  // Screen (§7)
  screen_share: 30,
  screen_record: 30,
  remote_desktop: 35,
  virtual_machine: 20,
  // Audio / voice (§8, §9)
  noise_high: 6,
  noise_background: 4,
  multiple_voices: 20,
  voice_change: 15,
  silence: 1,
  long_silence: 3,
  mic_muted: 5,
  mic_disconnected: 8,
  no_audio: 4,
  // Input analytics (§11)
  abnormal_typing: 8,
  repetitive_keys: 6,
  automated_input: 20,
  keyboard_idle: 1,
  mouse_idle: 1,
};

/** How much any single event type can contribute in total (diminishing returns). */
const TYPE_CAP = {
  looking_away: 20,
  head_turn: 16,
  eyes_closed: 16,
  gaze_off: 12,
  tab_switch: 50,
  window_blur: 24,
  copy: 24,
  right_click: 10,
  context_menu: 10,
  text_selection: 6,
  noise_high: 24,
  noise_background: 16,
  silence: 6,
  keyboard_idle: 6,
  mouse_idle: 6,
  zoom: 8,
};

const SEVERITY_BY_TYPE = (type) => {
  const w = SCORE_WEIGHTS[type] ?? 3;
  if (w >= 25) return 'high';
  if (w >= 8) return 'medium';
  return 'low';
};

/** Compute the 0–100 fraud score from the accumulated events. */
export function computeFraudScore(events = []) {
  const perType = {};
  for (const e of events) {
    const w = SCORE_WEIGHTS[e.type] ?? 3;
    perType[e.type] = (perType[e.type] || 0) + w;
  }
  let total = 0;
  for (const [type, sum] of Object.entries(perType)) {
    const cap = TYPE_CAP[type] ?? (SCORE_WEIGHTS[type] ?? 3) * 4;
    total += Math.min(sum, cap);
  }
  return Math.min(100, Math.round(total));
}

/** Map a fraud score to a risk band (§14). */
export function riskLevel(score) {
  if (score <= 20) return 'safe';
  if (score <= 40) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}

/** Aggregate counts by event type (for the audit summary + dashboard). */
export function summarizeEvents(events = []) {
  const counts = {};
  for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
  return counts;
}

/**
 * Record a batch of proctoring events on an interview, recompute the fraud +
 * integrity scores, flag/terminate per thresholds, and notify the recruiter live.
 * @param {import('../models/Interview.js').Interview} interview
 * @param {Array<{type:string, severity?:string, detail?:any, screenshotUrl?:string, at?:Date}>} events
 * @param {{ flagAt?:number, terminateAt?:number }} [opts]
 */
export async function recordEvents(interview, events, opts = {}) {
  const list = Array.isArray(events) ? events : [events];
  const flagAt = opts.flagAt ?? 60;
  const terminateAt = opts.terminateAt ?? 100;

  for (const e of list) {
    if (!e?.type) continue;
    interview.proctoring.events.push({
      type: e.type,
      severity: e.severity || SEVERITY_BY_TYPE(e.type),
      detail: e.detail,
      screenshotUrl: e.screenshotUrl,
      at: e.at ? new Date(e.at) : new Date(),
    });
  }

  const fraudScore = computeFraudScore(interview.proctoring.events);
  interview.proctoring.fraudScore = fraudScore;
  interview.proctoring.riskLevel = riskLevel(fraudScore);
  interview.proctoring.integrityScore = Math.max(0, 100 - fraudScore);

  let terminated = false;
  if (interview.status === 'in_progress') {
    if (fraudScore >= terminateAt) {
      interview.status = 'flagged';
      terminated = true;
    } else if (fraudScore >= flagAt) {
      interview.status = 'flagged';
    }
  }

  await interview.save();

  const last = list[list.length - 1];
  emitToCompany(interview.company, 'interview:proctoring', {
    id: interview._id,
    type: last?.type,
    fraudScore,
    riskLevel: interview.proctoring.riskLevel,
    integrityScore: interview.proctoring.integrityScore,
    flagged: interview.status === 'flagged',
  });

  return {
    fraudScore,
    riskLevel: interview.proctoring.riskLevel,
    integrityScore: interview.proctoring.integrityScore,
    flagged: interview.status === 'flagged',
    terminated,
  };
}

/** Persist the device + network fingerprint (§10). */
export async function setDeviceNetwork(interview, { device, network, attentionScore, eyeContactPct } = {}) {
  if (device) interview.proctoring.device = { ...interview.proctoring.device?.toObject?.(), ...device };
  if (network) interview.proctoring.network = { ...interview.proctoring.network?.toObject?.(), ...network };
  if (typeof attentionScore === 'number') interview.proctoring.attentionScore = Math.max(0, Math.min(100, attentionScore));
  if (typeof eyeContactPct === 'number') interview.proctoring.eyeContactPct = Math.max(0, Math.min(100, eyeContactPct));
  await interview.save();
  return interview.proctoring;
}

/** Attach a piece of evidence (screenshot / webcam snapshot / ID). */
export async function addEvidence(interview, { type = 'screenshot', reason, url }) {
  interview.proctoring.evidence.push({ type, reason, url, at: new Date() });
  await interview.save();
  return interview.proctoring.evidence[interview.proctoring.evidence.length - 1];
}

export default { SCORE_WEIGHTS, computeFraudScore, riskLevel, summarizeEvents, recordEvents, setDeviceNetwork, addEvidence };
