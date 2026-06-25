'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, Wifi, Globe, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';

type Status = 'pending' | 'ok' | 'fail';

interface Props {
  jobTitle: string;
  onReady: (stream: MediaStream | null) => void;
}

/** Pre-interview device & environment checks (camera, mic, internet, browser). */
export function PreCheck({ jobTitle, onReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<Status>('pending');
  const [mic, setMic] = useState<Status>('pending');
  const [internet, setInternet] = useState<Status>('pending');
  const [browser, setBrowser] = useState<Status>('pending');
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    let raf = 0;
    let audioCtx: AudioContext | null = null;

    (async () => {
      // Browser capability check
      setBrowser(
        typeof navigator.mediaDevices?.getUserMedia === 'function' &&
          typeof document.documentElement.requestFullscreen === 'function'
          ? 'ok'
          : 'fail',
      );
      // Internet
      setInternet(navigator.onLine ? 'ok' : 'fail');

      // Camera + mic — request HD so the recording is crisp, not blurry.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamera(stream.getVideoTracks().length ? 'ok' : 'fail');
        setMic(stream.getAudioTracks().length ? 'ok' : 'fail');

        // Live mic level meter
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          setMicLevel(Math.min(100, (data.reduce((a, b) => a + b, 0) / data.length) * 1.5));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setCamera('fail');
        setMic('fail');
      }
    })();

    return () => {
      cancelAnimationFrame(raf);
      audioCtx?.close();
    };
  }, []);

  const allOk = camera === 'ok' && mic === 'ok' && internet === 'ok' && browser === 'ok';

  const checks = [
    { label: 'Camera', icon: Camera, status: camera },
    { label: 'Microphone', icon: Mic, status: mic },
    { label: 'Internet', icon: Wifi, status: internet },
    { label: 'Browser', icon: Globe, status: browser },
  ];

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
      <GlassCard className="overflow-hidden p-0">
        <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full bg-black object-cover" />
        <div className="p-4">
          <p className="text-sm text-muted-foreground">Microphone level</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${micLevel}%` }} />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-xl font-bold">System check</h2>
        <p className="mt-1 text-sm text-muted-foreground">Interview for {jobTitle}</p>

        <div className="mt-6 space-y-3">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="flex items-center gap-3 text-sm">
                <c.icon className="h-5 w-5 text-muted-foreground" />
                {c.label}
              </span>
              {c.status === 'pending' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              {c.status === 'ok' && <CheckCircle2 className="h-5 w-5 text-accent" />}
              {c.status === 'fail' && <XCircle className="h-5 w-5 text-destructive" />}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Before you begin</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Find a quiet, well-lit space.</li>
            <li>The interview runs in fullscreen — leaving it is logged.</li>
            <li>Answer naturally; you can speak or type.</li>
          </ul>
        </div>

        <Button className="mt-6 w-full" magnetic={false} disabled={!allOk} onClick={() => onReady(streamRef.current)}>
          {allOk ? 'Start interview' : 'Waiting for camera & mic…'}
        </Button>
      </GlassCard>
    </div>
  );
}

export default PreCheck;
