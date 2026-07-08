/**
 * Webcam vision detection (§2, §3) using free, in-browser models:
 *  - TensorFlow.js COCO-SSD → counts PEOPLE in frame (one-person rule, enter/leave).
 *  - Browser FaceDetector API (where available) → face presence / face count.
 *
 * Everything is lazy-loaded (dynamic import) so TF.js never touches SSR or the
 * initial bundle. If a model or the network is unavailable, detection degrades
 * gracefully to "unknown" and the rest of the engine keeps working.
 */

export interface VisionResult {
  people: number;
  faces: number;
  facePresent: boolean;
  ok: boolean; // false when the model couldn't run this frame
}

type CocoModel = { detect: (el: HTMLVideoElement) => Promise<Array<{ class: string; score: number }>> };
type FaceDetectorLike = { detect: (el: HTMLVideoElement) => Promise<Array<unknown>> };

export class VisionDetector {
  private coco: CocoModel | null = null;
  private faceDetector: FaceDetectorLike | null = null;
  private loading = false;
  ready = false;

  async load(): Promise<boolean> {
    if (this.ready || this.loading) return this.ready;
    this.loading = true;
    try {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      this.coco = (await cocoSsd.load({ base: 'lite_mobilenet_v2' })) as unknown as CocoModel;

      // Browser-native face detector (Chrome/Edge) — optional, no download.
      const w = window as unknown as { FaceDetector?: new (o?: unknown) => FaceDetectorLike };
      if (w.FaceDetector) {
        try {
          this.faceDetector = new w.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
        } catch {
          this.faceDetector = null;
        }
      }
      this.ready = true;
    } catch {
      this.ready = false;
    } finally {
      this.loading = false;
    }
    return this.ready;
  }

  async detect(video: HTMLVideoElement): Promise<VisionResult> {
    const res: VisionResult = { people: 0, faces: 0, facePresent: false, ok: false };
    if (!this.ready || !video || video.readyState < 2) return res;
    try {
      const predictions = await this.coco!.detect(video);
      res.people = predictions.filter((p) => p.class === 'person' && p.score > 0.55).length;
      res.ok = true;

      if (this.faceDetector) {
        try {
          const faces = await this.faceDetector.detect(video);
          res.faces = faces.length;
        } catch {
          res.faces = res.people >= 1 ? 1 : 0;
        }
      } else {
        res.faces = res.people >= 1 ? 1 : 0; // fall back to person as face proxy
      }
      res.facePresent = res.faces >= 1 || res.people >= 1;
    } catch {
      res.ok = false;
    }
    return res;
  }
}

export default VisionDetector;
