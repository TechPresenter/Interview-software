/**
 * MediaPipe FaceLandmarker (Phase 2 · §1 liveness, §4 gaze/attention).
 *
 * Lazy-loads the free MediaPipe Face Landmarker (478 landmarks + blendshapes)
 * from the public CDN — no key, no bundle cost until the interview starts. From
 * each frame we derive: face presence, blink (→ passive liveness), smile, head
 * yaw, and iris-based gaze direction → an "attentive" (looking-at-screen) signal.
 * Degrades to ok:false if the model/CDN is unavailable; the rest of proctoring
 * keeps working.
 */

// Minimal structural type so we don't hard-depend on the SDK's types at build.
type Landmarker = { detectForVideo: (v: HTMLVideoElement, ts: number) => any; close: () => void };

export type GazeDir = 'center' | 'left' | 'right' | 'up' | 'down';

export interface FaceResult {
  ok: boolean;
  facePresent: boolean;
  eyesClosed: boolean;
  blinked: boolean; // a full blink completed this frame (eyes reopened)
  smile: boolean;
  yaw: number; // normalized head yaw, ~ -1 (left) .. +1 (right)
  gaze: GazeDir;
  attentive: boolean; // face forward + gaze centered + eyes open
}

const EMPTY: FaceResult = { ok: false, facePresent: false, eyesClosed: false, blinked: false, smile: false, yaw: 0, gaze: 'center', attentive: false };
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class FaceMeshDetector {
  private landmarker: Landmarker | null = null;
  private loading = false;
  ready = false;
  private wasClosed = false;

  async load(): Promise<boolean> {
    if (this.ready || this.loading) return this.ready;
    this.loading = true;
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
      this.landmarker = (await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      })) as unknown as Landmarker;
      this.ready = true;
    } catch {
      this.ready = false;
    } finally {
      this.loading = false;
    }
    return this.ready;
  }

  detect(video: HTMLVideoElement): FaceResult {
    if (!this.ready || !this.landmarker || video.readyState < 2) return EMPTY;
    let out: any;
    try {
      out = this.landmarker.detectForVideo(video, performance.now());
    } catch {
      return EMPTY;
    }
    const lm = out?.faceLandmarks?.[0];
    if (!lm) return { ...EMPTY, ok: true };

    const bs: Array<{ categoryName: string; score: number }> = out?.faceBlendshapes?.[0]?.categories || [];
    const shape = (n: string) => bs.find((c) => c.categoryName === n)?.score ?? 0;

    const eyesClosed = (shape('eyeBlinkLeft') + shape('eyeBlinkRight')) / 2 > 0.5;
    const blinked = this.wasClosed && !eyesClosed;
    this.wasClosed = eyesClosed;
    const smile = (shape('mouthSmileLeft') + shape('mouthSmileRight')) / 2 > 0.4;

    // Head yaw: nose tip vs the horizontal midpoint of the cheeks.
    const nose = lm[1], le = lm[234], re = lm[454];
    const faceW = Math.abs(re.x - le.x) || 1e-6;
    const yaw = ((nose.x - (le.x + re.x) / 2) / faceW) * 2;
    const yawOff = Math.abs(yaw) > 0.24;

    // Horizontal gaze: iris position within each eye (0..1, ~0.5 centred).
    const ratio = (iris: any, a: any, b: any) => (b.x - a.x ? (iris.x - a.x) / (b.x - a.x) : 0.5);
    const gR = ratio(lm[468], lm[33], lm[133]);
    const gL = ratio(lm[473], lm[362], lm[263]);
    const gx = (gR + gL) / 2;
    // Vertical gaze: iris between the eyelids.
    const gy = lm[145].y - lm[159].y ? (lm[468].y - lm[159].y) / (lm[145].y - lm[159].y) : 0.5;

    const hOff = Math.abs(gx - 0.5) > 0.24;
    const vOff = Math.abs(gy - 0.5) > 0.3;

    const gaze: GazeDir = yawOff ? (yaw > 0 ? 'right' : 'left') : hOff ? (gx > 0.5 ? 'left' : 'right') : vOff ? (gy > 0.5 ? 'down' : 'up') : 'center';
    const attentive = !yawOff && !hOff && !vOff && !eyesClosed;

    return { ok: true, facePresent: true, eyesClosed, blinked, smile, yaw, gaze, attentive };
  }

  close() {
    try { this.landmarker?.close(); } catch { /* noop */ }
    this.landmarker = null;
    this.ready = false;
  }
}

export default FaceMeshDetector;
