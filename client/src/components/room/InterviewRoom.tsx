'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, ShieldAlert, Clock, Loader2, SkipForward, Volume2, Maximize2, Users } from 'lucide-react';
import { AiAvatar } from './AiAvatar';
import { Waveform } from './Waveform';
import { Button } from '@/components/ui/Button';
import { roomApi, type RoomQuestion, type RoomProgress } from '@/lib/room.api';
import { toast } from '@/components/ui/toast';
import { enterFullscreen } from '@/hooks/useAntiCheat';
import { useProctoring } from '@/hooks/useProctoring';
import { loadVoices, speak, playAudios, stopSpeaking, type Lang } from '@/lib/voice';
import { cn } from '@/lib/utils';

type Phase = 'starting' | 'active' | 'submitting' | 'finishing' | 'done';
interface Turn { role: 'ai' | 'candidate'; text: string }

const RISK_CLASS: Record<string, string> = {
  safe: 'bg-accent/15 text-accent',
  low: 'bg-sky-500/15 text-sky-400',
  medium: 'bg-amber-500/15 text-amber-400',
  high: 'bg-orange-500/15 text-orange-400',
  critical: 'bg-destructive/15 text-destructive',
};

export function InterviewRoom({
  token, durationMinutes, stream, onDone,
  initialLanguage = 'en', allowLanguageChange = false, allowSkip = true, initialSkips = 0, interviewer,
}: {
  token: string;
  durationMinutes: number;
  stream: MediaStream | null;
  onDone: () => void;
  initialLanguage?: Lang;
  allowLanguageChange?: boolean;
  allowSkip?: boolean;
  initialSkips?: number;
  interviewer?: { name?: string; avatarUrl?: string | null; voice?: 'female' | 'male' | 'auto'; intro?: string | null };
}) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [lang, setLang] = useState<Lang>(initialLanguage);
  const [question, setQuestion] = useState<RoomQuestion | null>(null);
  const [progress, setProgress] = useState<RoomProgress>({ current: 0, total: 8 });
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [committed, setCommitted] = useState('');
  const [interim, setInterim] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [skipsLeft, setSkipsLeft] = useState(initialSkips);

  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mimeRef = useRef<string>('video/webm');
  // Incremental recording upload: queue chunks + a single-flight pump so the full
  // 1080p recording streams to the server throughout the interview.
  const uploadQueue = useRef<Blob[]>([]);
  const uploadingRef = useRef(false);
  const firstChunkRef = useRef(true);
  const recognitionRef = useRef<any>(null);
  const answerStart = useRef<number>(Date.now());
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const displayAnswer = (committed + (interim ? (committed ? ' ' : '') + interim : '')).trimStart();

  // Device / browser capabilities (computed once, client-side).
  const [caps] = useState(() => ({
    mobile: typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent),
    speech: typeof window !== 'undefined' && !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition),
  }));

  // Full AI proctoring engine: browser lock, tab/window, noise, input analytics,
  // webcam person/face detection, device fingerprint, screenshots + live fraud score.
  // On mobile the heavy MediaPipe gaze model is dropped and vision runs slower so
  // the interview stays smooth on low-power devices.
  const proctor = useProctoring({
    token,
    enabled: phase === 'active' || phase === 'submitting',
    getVideo: () => selfVideoRef.current,
    config: caps.mobile ? { faceMesh: false, visionIntervalMs: 7000 } : undefined,
  });
  const violations = proctor.violations;

  /* ── TTS: prefer Sarvam (natural Indian voice, EN/HI); fall back to browser ── */
  const speakText = useCallback(async (text: string, l: Lang) => {
    stopSpeaking();
    setSpeaking(true);
    try {
      const res = await roomApi.tts(token, text, l, interviewer?.voice || 'female');
      if (res?.audios?.length) {
        await playAudios(res.audios, res.mime || 'audio/wav', { onEnd: () => setSpeaking(false) });
        return;
      }
    } catch {
      /* fall back to browser speech synthesis below */
    }
    speak(text, l, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false), voice: interviewer?.voice || 'female' });
  }, [token, interviewer?.voice]);
  const pushAi = useCallback((text: string, l: Lang) => {
    setTranscript((t) => [...t, { role: 'ai', text }]);
    speakText(text, l);
  }, [speakText]);

  /* ── Live speech-to-text into the answer box ── */
  // Tracks the user's intent so mobile browsers (which auto-stop after a pause)
  // can transparently restart the mic while the candidate still wants to speak.
  const wantListenRef = useRef(false);
  const startRecognition = useCallback((l: Lang) => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = l === 'hi' ? 'hi-IN' : 'en-IN';
    rec.onresult = (e: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setCommitted((c) => (c ? `${c} ${finalText}` : finalText));
      setInterim(interimText);
    };
    rec.onerror = (e: any) => {
      // Permission/hardware errors are fatal; transient ones let onend restart.
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed' || e?.error === 'audio-capture') {
        wantListenRef.current = false;
        setListening(false);
      }
    };
    rec.onend = () => {
      // Auto-restart on mobile browsers that stop after a short silence.
      if (wantListenRef.current) {
        try { rec.start(); return; } catch { /* fall through to stop */ }
      }
      setListening(false);
    };
    return rec;
  }, []);

  const stopListening = useCallback(() => {
    wantListenRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
    setInterim('');
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) { stopListening(); return; }
    const rec = startRecognition(lang);
    if (!rec) { toast.error('Voice input isn’t supported on this browser — please type your answer.'); return; }
    recognitionRef.current = rec;
    wantListenRef.current = true;
    try { rec.start(); setListening(true); } catch { wantListenRef.current = false; }
  }, [listening, lang, startRecognition, stopListening]);

  /* ── Recording (incremental chunk upload, full-length 1080p) ── */
  const pumpUploads = useCallback(async () => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    while (uploadQueue.current.length) {
      const blob = uploadQueue.current.shift()!;
      const first = firstChunkRef.current;
      firstChunkRef.current = false;
      // Sequential + ordered so the appended file reconstructs correctly.
      // eslint-disable-next-line no-await-in-loop
      const res = await roomApi.uploadRecordingChunk(token, blob, first);
      if (res === null && first) firstChunkRef.current = true; // retry header chunk next time
    }
    uploadingRef.current = false;
  }, [token]);

  const startRecording = useCallback(() => {
    if (!stream) return;
    try {
      const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      const mime = candidates.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || 'video/webm';
      mimeRef.current = mime;
      firstChunkRef.current = true;
      uploadQueue.current = [];
      // ~4 Mbps for crisp 1080p; audio 128 kbps.
      const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
      mr.ondataavailable = (e) => { if (e.data && e.data.size) { uploadQueue.current.push(e.data); void pumpUploads(); } };
      mr.start(5000); // emit a chunk every 5s → uploaded incrementally
      recorderRef.current = mr;
      if (selfVideoRef.current) selfVideoRef.current.srcObject = stream;
    } catch { /* unsupported */ }
  }, [stream, pumpUploads]);

  const stopAndUpload = useCallback(async () => {
    const mr = recorderRef.current;
    if (mr && mr.state !== 'inactive') {
      await new Promise<void>((resolve) => { mr.onstop = () => resolve(); try { mr.requestData(); } catch { /* noop */ } mr.stop(); });
    }
    // Drain any remaining queued chunks before we leave the page.
    await pumpUploads();
    let guard = 0;
    while ((uploadQueue.current.length > 0 || uploadingRef.current) && guard++ < 300) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
    }
  }, [pumpUploads]);

  /* ── Start ── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadVoices();
      await enterFullscreen();
      startRecording();
      try {
        const res = await roomApi.start(token, lang);
        if (!mounted) return;
        const intro = [interviewer?.intro, res.greeting, res.question?.text].filter(Boolean).join(' ');
        setTranscript([interviewer?.intro && { role: 'ai', text: interviewer.intro }, res.greeting && { role: 'ai', text: res.greeting }, res.question && { role: 'ai', text: res.question.text }].filter(Boolean) as Turn[]);
        setQuestion(res.question);
        setProgress(res.progress);
        const saved = localStorage.getItem(`iv:${token}:0`);
        if (saved) setCommitted(saved);
        speakText(intro, lang);
        setPhase('active');
        answerStart.current = Date.now();
      } catch {
        if (mounted) setPhase('active');
      }
    })();
    return () => { mounted = false; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ── Timer ── */
  useEffect(() => {
    if (phase === 'done') return;
    const id = setInterval(() => {
      setTimeLeft((t) => { if (t <= 1) { clearInterval(id); finish(); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => { if (phase === 'active') localStorage.setItem(`iv:${token}:${progress.current}`, committed); }, [committed, token, progress.current, phase]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  async function changeLanguage(next: Lang) {
    if (next === lang) return;
    setLang(next);
    await roomApi.setLanguage(token, next).catch(() => {});
    if (listening) {
      wantListenRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      setTimeout(() => {
        const r = startRecognition(next);
        if (r) { recognitionRef.current = r; wantListenRef.current = true; try { r.start(); setListening(true); } catch { wantListenRef.current = false; } }
      }, 300);
    }
  }

  async function submit() {
    if (phase !== 'active') return;
    setPhase('submitting');
    stopListening();
    const text = displayAnswer.trim();
    setTranscript((t) => [...t, { role: 'candidate', text: text || '(no answer)' }]);
    localStorage.removeItem(`iv:${token}:${progress.current}`);
    try {
      const res = await roomApi.answer(token, { answer: text, durationSeconds: Math.round((Date.now() - answerStart.current) / 1000) });
      setCommitted(''); setInterim('');
      if (res.done) { pushAi(res.message, lang); await finish(); return; }
      if (!res.question) {
        // Backend advanced but returned no question — recover to active so the
        // room is never stuck; the candidate can submit again to fetch the next.
        answerStart.current = Date.now();
        setPhase('active');
        toast.info(lang === 'hi' ? 'अगला प्रश्न लोड हो रहा है…' : 'Loading the next question…');
        return;
      }
      setQuestion(res.question); setProgress(res.progress); pushAi(res.question.text, lang);
      answerStart.current = Date.now(); setPhase('active');
    } catch {
      // Never leave the room frozen on "submitting" (e.g. a dropped mobile
      // connection): restore the answer, drop the optimistic turn, and let them retry.
      setCommitted(text);
      setTranscript((t) => (t[t.length - 1]?.role === 'candidate' ? t.slice(0, -1) : t));
      setPhase('active');
      toast.error(lang === 'hi' ? 'उत्तर सबमिट नहीं हुआ — कृपया दोबारा प्रयास करें।' : 'Couldn’t submit — check your connection and try again.');
    }
  }

  async function skipQuestion() {
    if (phase !== 'active' || skipsLeft <= 0) return;
    setPhase('submitting');
    stopListening();
    setTranscript((t) => [...t, { role: 'candidate', text: '(skipped)' }]);
    try {
      const res = await roomApi.skip(token);
      setCommitted(''); setInterim('');
      if (typeof res.skipsRemaining === 'number') setSkipsLeft(res.skipsRemaining);
      else setSkipsLeft((s) => Math.max(0, s - 1));
      if (res.done) { pushAi(res.message, lang); await finish(); return; }
      if (res.question) { setQuestion(res.question); setProgress(res.progress); pushAi(res.question.text, lang); }
      answerStart.current = Date.now(); setPhase('active');
    } catch {
      setTranscript((t) => (t[t.length - 1]?.role === 'candidate' ? t.slice(0, -1) : t));
      setPhase('active');
      toast.error(lang === 'hi' ? 'स्किप नहीं हुआ — दोबारा प्रयास करें।' : 'Couldn’t skip — please try again.');
    }
  }

  async function finish() {
    setPhase('finishing');
    stopSpeaking();
    await stopAndUpload();
    try { await roomApi.complete(token); } catch { /* ignore */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setPhase('done');
  }

  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const confidence = Math.min(100, Math.round(displayAnswer.length / 2.2) + (speaking ? 8 : 0));
  const lastIsAi = transcript[transcript.length - 1]?.role === 'ai';

  if (phase === 'done') {
    return (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mx-auto mb-6"><AiAvatar speaking={false} avatarUrl={interviewer?.avatarUrl} /></motion.div>
          <h1 className="text-3xl font-bold">{lang === 'hi' ? 'इंटरव्यू पूरा हुआ 🎉' : 'Interview complete 🎉'}</h1>
          <p className="mt-2 text-muted-foreground">{lang === 'hi' ? 'धन्यवाद! आपके उत्तर रिकॉर्ड कर लिए गए हैं और उनका मूल्यांकन हो रहा है।' : 'Thanks for your time. Your responses were recorded and are being evaluated.'}</p>
          <Button className="mt-8" magnetic={false} onClick={onDone}>{lang === 'hi' ? 'डैशबोर्ड पर जाएँ' : 'Back to dashboard'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]">
      {/* Main */}
      <div className="space-y-6">
        {/* Top bar */}
        <div className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4">
          <div className="min-w-[160px] flex-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{lang === 'hi' ? 'प्रश्न' : 'Question'} {Math.min(progress.current + 1, progress.total)}/{progress.total}</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" animate={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Language: switchable only if the company allowed it; otherwise locked to the scheduled language */}
          {allowLanguageChange ? (
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              {(['en', 'hi'] as const).map((l) => (
                <button key={l} onClick={() => changeLanguage(l)} className={cn('rounded-md px-2.5 py-1 font-medium transition', lang === l ? 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white' : 'text-muted-foreground')}>
                  {l === 'en' ? 'EN' : 'हिं'}
                </button>
              ))}
            </div>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground"
              title={lang === 'hi' ? 'इस इंटरव्यू की भाषा तय है' : 'The language is fixed for this interview'}
            >
              {lang === 'en' ? 'EN' : 'हिं'}
            </span>
          )}

          <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-sm tabular-nums"><Clock className="h-4 w-4 text-muted-foreground" /> {mm}:{ss}</div>

          {/* Live proctoring HUD */}
          {proctor.people !== 1 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-1.5 text-sm text-destructive" title="People detected in the camera frame">
              <Users className="h-4 w-4" /> {proctor.people}
            </div>
          )}
          <div
            className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm capitalize', RISK_CLASS[proctor.riskLevel] || RISK_CLASS.safe)}
            title={`Fraud score ${proctor.fraudScore}/100 · ${violations} event${violations === 1 ? '' : 's'}`}
          >
            <ShieldAlert className="h-4 w-4" /> {proctor.riskLevel} · {proctor.fraudScore}
          </div>
        </div>

        {/* Avatar + question */}
        <div className="glass relative flex flex-col items-center gap-5 overflow-hidden rounded-2xl p-8 text-center">
          <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-20" />
          <AiAvatar speaking={speaking} avatarUrl={interviewer?.avatarUrl} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {speaking ? <><Volume2 className="h-3.5 w-3.5 text-primary" /> {(interviewer?.name || 'Sense')} {lang === 'hi' ? 'बोल रहा है…' : 'is speaking…'}</> : <span>{interviewer?.name || 'Sense'}</span>}
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={question?.text} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="max-w-2xl text-xl font-medium">
              {question?.text || (lang === 'hi' ? 'आपका पहला प्रश्न तैयार हो रहा है…' : 'Preparing your first question…')}
            </motion.p>
          </AnimatePresence>
          {question?.text && phase === 'active' && (
            <Button variant="glass" size="sm" magnetic={false} onClick={() => speakText(question.text, lang)}>
              <Volume2 className="h-4 w-4" /> {lang === 'hi' ? 'प्रश्न दोबारा सुनें' : 'Repeat question'}
            </Button>
          )}
          {/* AI typing indicator */}
          {phase === 'submitting' && !lastIsAi && (
            <div className="flex gap-1">{[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />)}</div>
          )}
        </div>

        {/* Answer */}
        <div className="glass rounded-2xl p-4">
          <textarea
            value={displayAnswer}
            onChange={(e) => { setCommitted(e.target.value); setInterim(''); }}
            placeholder={caps.speech ? (lang === 'hi' ? 'अपना उत्तर लिखें, या बोलने के लिए माइक दबाएँ…' : 'Type your answer, or tap the mic to speak…') : (lang === 'hi' ? 'अपना उत्तर यहाँ लिखें…' : 'Type your answer here…')}
            rows={4}
            disabled={phase !== 'active'}
            className="w-full resize-none rounded-xl border border-input bg-background/60 p-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
          />
          {/* confidence meter */}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{lang === 'hi' ? 'आत्मविश्वास' : 'Confidence'}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--accent)),hsl(var(--primary)))]" animate={{ width: `${confidence}%` }} /></div>
            <span className="tabular-nums">{confidence}%</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant={listening ? 'primary' : 'glass'} size="sm" magnetic={false}
                disabled={phase !== 'active' || !caps.speech}
                title={!caps.speech ? 'Voice input isn’t supported on this browser — please type your answer' : undefined}
                onClick={toggleListening}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {listening ? (lang === 'hi' ? 'रोकें' : 'Stop') : (lang === 'hi' ? 'बोलें' : 'Speak')}
              </Button>
              {allowSkip && (
                <Button variant="ghost" size="sm" magnetic={false} disabled={phase !== 'active' || skipsLeft <= 0} onClick={skipQuestion} title={skipsLeft <= 0 ? 'No skips left' : 'Skip / ask another'}>
                  <SkipForward className="h-4 w-4" /> {lang === 'hi' ? 'छोड़ें' : 'Skip'} ({skipsLeft})
                </Button>
              )}
            </div>
            <Button magnetic={false} disabled={phase !== 'active'} onClick={submit}>
              {phase === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {progress.current + 1 >= progress.total ? (lang === 'hi' ? 'जमा करें व समाप्त' : 'Submit & finish') : (lang === 'hi' ? 'उत्तर भेजें' : 'Submit answer')}
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <div className="glass overflow-hidden rounded-2xl">
          <video ref={selfVideoRef} autoPlay muted playsInline className="aspect-video w-full bg-black object-cover" />
          <div className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> REC</span>
            <Waveform stream={stream} active={listening || speaking} bars={20} />
            <button onClick={enterFullscreen} className="text-muted-foreground hover:text-foreground" title="Fullscreen"><Maximize2 className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <h3 className="mb-3 text-sm font-semibold">{lang === 'hi' ? 'लाइव ट्रांसक्रिप्ट' : 'Live transcript'}</h3>
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1 text-sm">
            {transcript.map((t, i) => (
              <div key={i} className={cn('rounded-xl px-3 py-2', t.role === 'ai' ? 'bg-primary/10' : 'bg-muted/50')}>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.role === 'ai' ? (interviewer?.name || 'Sense') : 'You'}</span>
                <p>{t.text}</p>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      {(phase === 'finishing' || phase === 'starting') && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{phase === 'finishing' ? (lang === 'hi' ? 'रिपोर्ट तैयार की जा रही है…' : 'Wrapping up & generating your report…') : (lang === 'hi' ? 'जुड़ रहे हैं…' : 'Connecting…')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default InterviewRoom;
