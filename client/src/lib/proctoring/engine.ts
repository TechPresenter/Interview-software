import { roomApi } from '@/lib/room.api';
import { captureDevice, captureNetwork, requestPreciseLocation } from './device';
import { VisionDetector } from './vision';

/**
 * Proctoring engine — orchestrates every browser-side detector, batches events,
 * captures screenshot evidence on triggers, and maintains a live fraud score.
 *
 * Subsystems: browser security (§5), tab/window monitoring (§6), noise (§8),
 * keyboard/mouse analytics (§11), and webcam person/face detection (§2/§3).
 * MediaPipe gaze/liveness/voice-diarization are layered on in Phase 2.
 */

export type Severity = 'low' | 'medium' | 'high';
export interface ProctorEvent { type: string; severity?: Severity; detail?: unknown; at: number }

export interface ProctorConfig {
  browserLock: boolean;
  windowMonitor: boolean;
  audio: boolean;
  vision: boolean;
  input: boolean;
  screenshots: boolean;
  visionIntervalMs: number;
  flushMs: number;
  idleMs: number;
  requestLocation: boolean;
}

export const DEFAULT_CONFIG: ProctorConfig = {
  browserLock: true,
  windowMonitor: true,
  audio: true,
  vision: true,
  input: true,
  screenshots: true,
  visionIntervalMs: 3500,
  flushMs: 5000,
  idleMs: 45000,
  requestLocation: false,
};

// Client-side mirror of the key server weights (for the live HUD score only —
// the server is always the source of truth).
const W: Record<string, number> = {
  multiple_faces: 40, person_entered: 20, person_left: 10, face_missing: 15,
  looking_away: 5, dev_tools: 25, view_source: 20, paste: 12, copy: 6, cut: 6,
  right_click: 2, context_menu: 2, text_selection: 1, drag_drop: 3, print_screen: 15, zoom: 2,
  tab_switch: 10, window_blur: 6, window_minimize: 10, fullscreen_exit: 10, multi_monitor: 8, multi_tab: 15,
  noise_high: 6, noise_background: 4, silence: 1, mic_muted: 5, mic_disconnected: 8,
  abnormal_typing: 8, repetitive_keys: 6, automated_input: 20, keyboard_idle: 1, mouse_idle: 1,
};
const CAP: Record<string, number> = {
  looking_away: 20, tab_switch: 50, window_blur: 24, copy: 24, right_click: 10, context_menu: 10,
  text_selection: 6, noise_high: 24, noise_background: 16, silence: 6, keyboard_idle: 6, mouse_idle: 6, zoom: 8,
};

export interface ProctorUpdate {
  fraudScore: number;
  riskLevel: string;
  lastEvent?: ProctorEvent;
  counts: Record<string, number>;
  people: number;
  noise: number;
  warning?: string;
}

const riskLevel = (s: number) => (s <= 20 ? 'safe' : s <= 40 ? 'low' : s <= 60 ? 'medium' : s <= 80 ? 'high' : 'critical');

export class ProctoringEngine {
  private token: string;
  private cfg: ProctorConfig;
  private getVideo: () => HTMLVideoElement | null;
  private onUpdate?: (u: ProctorUpdate) => void;

  private queue: ProctorEvent[] = [];
  private counts: Record<string, number> = {};
  private lastRecord: Record<string, number> = {};
  private running = false;

  // timers / handles
  private flushTimer?: ReturnType<typeof setInterval>;
  private visionTimer?: ReturnType<typeof setInterval>;
  private audioTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setInterval>;
  private cleanups: Array<() => void> = [];

  private vision = new VisionDetector();
  private prevPeople = 1;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private micStream?: MediaStream;
  noise = 0;
  people = 1;

  private lastKeyAt = Date.now();
  private lastMouseAt = Date.now();
  private keyTimes: number[] = [];
  private channel?: BroadcastChannel;

  constructor(opts: {
    token: string;
    getVideo?: () => HTMLVideoElement | null;
    config?: Partial<ProctorConfig>;
    onUpdate?: (u: ProctorUpdate) => void;
  }) {
    this.token = opts.token;
    this.cfg = { ...DEFAULT_CONFIG, ...opts.config };
    this.getVideo = opts.getVideo || (() => null);
    this.onUpdate = opts.onUpdate;
  }

  /* ── lifecycle ─────────────────────────────────────────── */

  async start() {
    if (this.running) return;
    this.running = true;

    // §10 device + network fingerprint
    void this.reportDevice();

    if (this.cfg.browserLock) this.installBrowserLock();
    if (this.cfg.windowMonitor) this.installWindowMonitor();
    if (this.cfg.input) this.installInputMonitor();
    if (this.cfg.audio) void this.startAudio();
    if (this.cfg.vision) void this.startVision();

    this.flushTimer = setInterval(() => this.flush(), this.cfg.flushMs);
  }

  async stop() {
    this.running = false;
    for (const c of this.cleanups) c();
    this.cleanups = [];
    [this.flushTimer, this.visionTimer, this.audioTimer, this.idleTimer].forEach((t) => t && clearInterval(t));
    try { this.audioCtx?.close(); } catch { /* noop */ }
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.channel?.close();
    await this.flush();
  }

  private async reportDevice() {
    try {
      const device = captureDevice();
      const network = await captureNetwork();
      if (this.cfg.requestLocation) {
        const loc = await requestPreciseLocation();
        if (loc) { network.lat = loc.lat; network.lng = loc.lng; }
      }
      await roomApi.device(this.token, { device, network });
    } catch { /* best-effort */ }
  }

  /* ── event recording ───────────────────────────────────── */

  /** Continuous signals are throttled; discrete ones (paste, tab_switch) always fire. */
  private throttled(type: string, ms = 5000) {
    const now = Date.now();
    if (now - (this.lastRecord[type] || 0) < ms) return true;
    this.lastRecord[type] = now;
    return false;
  }

  record(type: string, severity: Severity = 'low', detail?: unknown, opts?: { screenshot?: boolean }) {
    if (!this.running) return;
    const ev: ProctorEvent = { type, severity, detail, at: Date.now() };
    this.queue.push(ev);
    this.counts[type] = (this.counts[type] || 0) + 1;
    if (opts?.screenshot && this.cfg.screenshots) void this.captureScreenshot(type);
    this.emit(ev);
    if (this.queue.length >= 25) void this.flush();
  }

  private liveScore() {
    let total = 0;
    for (const [type, n] of Object.entries(this.counts)) {
      const contrib = (W[type] ?? 3) * n;
      total += Math.min(contrib, CAP[type] ?? (W[type] ?? 3) * 4);
    }
    return Math.min(100, Math.round(total));
  }

  private emit(lastEvent?: ProctorEvent) {
    const fraudScore = this.liveScore();
    this.onUpdate?.({
      fraudScore,
      riskLevel: riskLevel(fraudScore),
      lastEvent,
      counts: { ...this.counts },
      people: this.people,
      noise: this.noise,
    });
  }

  private async flush() {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    await roomApi.proctoringBatch(this.token, batch);
  }

  /* ── §13 screenshot evidence ───────────────────────────── */

  async captureScreenshot(reason: string) {
    const video = this.getVideo();
    if (!video || video.readyState < 2) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.videoWidth || 640, 640);
      canvas.height = Math.min(video.videoHeight || 480, 480);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      await roomApi.evidence(this.token, dataUrl, reason, 'webcam');
    } catch { /* noop */ }
  }

  /* ── §5 browser security ───────────────────────────────── */

  private installBrowserLock() {
    const onContext = (e: Event) => { e.preventDefault(); this.record('context_menu', 'low'); };
    const onCopy = () => this.record('copy', 'medium');
    const onCut = () => this.record('cut', 'medium');
    const onPaste = (e: Event) => { e.preventDefault(); this.record('paste', 'high'); };
    const onDrag = (e: Event) => { e.preventDefault(); this.record('drag_drop', 'low'); };
    const onSelect = (e: Event) => { e.preventDefault(); if (!this.throttled('text_selection', 4000)) this.record('text_selection', 'low'); };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key?.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      // DevTools: F12, Ctrl+Shift+I/J/C
      if (e.key === 'F12' || (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(k))) { e.preventDefault(); this.record('dev_tools', 'high', null, { screenshot: true }); return; }
      // View source: Ctrl+U
      if (ctrl && k === 'u') { e.preventDefault(); this.record('view_source', 'high'); return; }
      // Save page: Ctrl+S
      if (ctrl && k === 's') { e.preventDefault(); return; }
      // Zoom: Ctrl +/-/0
      if (ctrl && ['+', '-', '=', '0'].includes(k)) { if (!this.throttled('zoom', 3000)) this.record('zoom', 'low'); return; }
      // PrintScreen (best-effort)
      if (e.key === 'PrintScreen') { this.record('print_screen', 'medium', null, { screenshot: true }); }
    };
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    document.addEventListener('dragstart', onDrag);
    document.addEventListener('selectstart', onSelect);
    document.addEventListener('keydown', onKey, true);
    this.cleanups.push(() => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('dragstart', onDrag);
      document.removeEventListener('selectstart', onSelect);
      document.removeEventListener('keydown', onKey, true);
    });
  }

  /* ── §6 tab / window monitoring ────────────────────────── */

  private installWindowMonitor() {
    const onVis = () => { if (document.hidden) this.record('tab_switch', 'medium', null, { screenshot: true }); };
    const onBlur = () => this.record('window_blur', 'low');
    const onFs = () => { if (!document.fullscreenElement) this.record('fullscreen_exit', 'medium', null, { screenshot: true }); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('fullscreenchange', onFs);
    this.cleanups.push(() => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('fullscreenchange', onFs);
    });

    // Multiple monitors (best-effort) — Window Management API.
    const scr = window.screen as Screen & { isExtended?: boolean };
    if (scr.isExtended) this.record('multi_monitor', 'low');

    // Multiple interview tabs — BroadcastChannel handshake keyed by token.
    try {
      this.channel = new BroadcastChannel(`proctor-${this.token}`);
      this.channel.onmessage = (e) => { if (e.data === 'ping') this.channel?.postMessage('pong'); if (e.data === 'pong') this.record('multi_tab', 'medium'); };
      this.channel.postMessage('ping');
    } catch { /* not supported */ }
  }

  /* ── §8 noise detection ────────────────────────────────── */

  async startAudio() {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx();
      const src = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      const buf = new Uint8Array(this.analyser.frequencyBinCount);

      const track = this.micStream.getAudioTracks()[0];
      track.addEventListener('ended', () => this.record('mic_disconnected', 'medium'));

      let silentTicks = 0;
      this.audioTimer = setInterval(() => {
        if (!this.analyser) return;
        if (track && track.muted) { if (!this.throttled('mic_muted', 8000)) this.record('mic_muted', 'medium'); }
        this.analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length); // 0..~255
        this.noise = Math.round((rms / 255) * 100);
        if (this.noise > 65) { if (!this.throttled('noise_high', 6000)) this.record('noise_high', 'medium', { level: this.noise }); silentTicks = 0; }
        else if (this.noise > 40) { if (!this.throttled('noise_background', 8000)) this.record('noise_background', 'low', { level: this.noise }); silentTicks = 0; }
        else if (this.noise < 4) { silentTicks++; if (silentTicks === 12) this.record('long_silence', 'low'); }
        else silentTicks = 0;
        this.emit();
      }, 1000);
    } catch {
      this.record('mic_disconnected', 'medium');
    }
  }

  /* ── §11 keyboard / mouse analytics ────────────────────── */

  private installInputMonitor() {
    const onKey = () => {
      const now = Date.now();
      this.lastKeyAt = now;
      this.keyTimes.push(now);
      if (this.keyTimes.length > 20) this.keyTimes.shift();
      if (this.keyTimes.length >= 12) {
        const span = (this.keyTimes[this.keyTimes.length - 1] - this.keyTimes[0]) / 1000;
        const cpm = (this.keyTimes.length / span) * 60;
        if (cpm > 900 && !this.throttled('abnormal_typing', 10000)) this.record('abnormal_typing', 'medium', { cpm: Math.round(cpm) });
        // Automated input: near-identical inter-key intervals (macro/paste-typing).
        const iv: number[] = [];
        for (let i = 1; i < this.keyTimes.length; i++) iv.push(this.keyTimes[i] - this.keyTimes[i - 1]);
        const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
        const variance = iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length;
        if (mean < 120 && variance < 100 && !this.throttled('automated_input', 15000)) this.record('automated_input', 'high');
      }
    };
    const onMouse = () => { this.lastMouseAt = Date.now(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousemove', onMouse);
    this.cleanups.push(() => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousemove', onMouse);
    });

    this.idleTimer = setInterval(() => {
      const now = Date.now();
      if (now - this.lastKeyAt > this.cfg.idleMs && !this.throttled('keyboard_idle', this.cfg.idleMs)) this.record('keyboard_idle', 'low');
      if (now - this.lastMouseAt > this.cfg.idleMs && !this.throttled('mouse_idle', this.cfg.idleMs)) this.record('mouse_idle', 'low');
    }, 5000);
  }

  /* ── §2 / §3 webcam person + face detection ────────────── */

  async startVision() {
    const loaded = await this.vision.load();
    if (!loaded) return;
    this.visionTimer = setInterval(async () => {
      const video = this.getVideo();
      if (!video) return;
      const r = await this.vision.detect(video);
      if (!r.ok) return;
      this.people = r.people;

      if (r.people >= 2) {
        if (!this.throttled('multiple_faces', 6000)) this.record('multiple_faces', 'high', { people: r.people }, { screenshot: true });
      } else if (r.people === 0 || !r.facePresent) {
        if (!this.throttled('face_missing', 6000)) this.record('face_missing', 'medium', null, { screenshot: true });
      }
      // Person entering / leaving the frame.
      if (r.people > this.prevPeople && this.prevPeople >= 1) this.record('person_entered', 'high', { people: r.people });
      else if (r.people < this.prevPeople && r.people >= 1) this.record('person_left', 'medium', { people: r.people });
      this.prevPeople = r.people;
      this.emit();
    }, this.cfg.visionIntervalMs);
  }
}

export default ProctoringEngine;
