'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, ShieldAlert, Clock, Loader2, SkipForward, Volume2, Maximize2 } from 'lucide-react';
import { AiAvatar } from './AiAvatar';
import { Waveform } from './Waveform';
import { Button } from '@/components/ui/Button';
import { roomApi, type RoomQuestion, type RoomProgress } from '@/lib/room.api';
import { useAntiCheat, enterFullscreen } from '@/hooks/useAntiCheat';
import { loadVoices, speak, playAudios, stopSpeaking, type Lang } from '@/lib/voice';
import { cn } from '@/lib/utils';

type Phase = 'starting' | 'active' | 'submitting' | 'finishing' | 'done';
interface Turn { role: 'ai' | 'candidate'; text: string }

export function InterviewRoom({
  token, durationMinutes, stream, onDone,
  initialLanguage = 'en', allowSkip = true, initialSkips = 0, interviewer,
}: {
  token: string;
  durationMinutes: number;
  stream: MediaStream | null;
  onDone: () => void;
  initialLanguage?: Lang;
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
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>('video/webm');
  const recognitionRef = useRef<any>(null);
  const answerStart = useRef<number>(Date.now());
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const displayAnswer = (committed + (interim ? (committed ? ' ' : '') + interim : '')).trimStart();

  const { violations } = useAntiCheat({
    enabled: phase === 'active' || phase === 'submitting',
    onEvent: (type, severity) => roomApi.proctoring(token, type, severity),
  });

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
    rec.onend = () => setListening(false);
    return rec;
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setInterim('');
      return;
    }
    const rec = startRecognition(lang);
    if (!rec) return;
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, lang, startRecognition]);

  /* ── Recording ── */
  const startRecording = useCallback(() => {
    if (!stream) return;
    try {
      // Prefer modern codecs for clear video; fall back gracefully.
      const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      const mime = candidates.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || 'video/webm';
      mimeRef.current = mime;
      const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.start(2000);
      recorderRef.current = mr;
      if (selfVideoRef.current) selfVideoRef.current.srcObject = stream;
    } catch { /* unsupported */ }
  }, [stream]);

  const stopAndUpload = useCallback(async () => {
    const mr = recorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
    if (chunksRef.current.length) await roomApi.uploadRecording(token, new Blob(chunksRef.current, { type: mimeRef.current }));
  }, [token]);

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
    if (listening) { recognitionRef.current?.stop(); setTimeout(() => { const r = startRecognition(next); if (r) { recognitionRef.current = r; r.start(); setListening(true); } }, 250); }
  }

  async function submit() {
    if (phase !== 'active') return;
    setPhase('submitting');
    recognitionRef.current?.stop();
    setListening(false);
    const text = displayAnswer.trim();
    setTranscript((t) => [...t, { role: 'candidate', text: text || '(no answer)' }]);
    localStorage.removeItem(`iv:${token}:${progress.current}`);
    try {
      const res = await roomApi.answer(token, { answer: text, durationSeconds: Math.round((Date.now() - answerStart.current) / 1000) });
      setCommitted(''); setInterim('');
      if (res.done) { pushAi(res.message, lang); await finish(); return; }
      setQuestion(res.question); setProgress(res.progress); pushAi(res.question.text, lang);
      answerStart.current = Date.now(); setPhase('active');
    } catch { setPhase('active'); }
  }

  async function skipQuestion() {
    if (phase !== 'active' || skipsLeft <= 0) return;
    setPhase('submitting');
    recognitionRef.current?.stop(); setListening(false);
    setTranscript((t) => [...t, { role: 'candidate', text: '(skipped)' }]);
    try {
      const res = await roomApi.skip(token);
      setCommitted(''); setInterim('');
      if (typeof res.skipsRemaining === 'number') setSkipsLeft(res.skipsRemaining);
      else setSkipsLeft((s) => Math.max(0, s - 1));
      if (res.done) { pushAi(res.message, lang); await finish(); return; }
      setQuestion(res.question); setProgress(res.progress); pushAi(res.question.text, lang);
      answerStart.current = Date.now(); setPhase('active');
    } catch { setPhase('active'); }
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

          {/* Language switch */}
          <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
            {(['en', 'hi'] as const).map((l) => (
              <button key={l} onClick={() => changeLanguage(l)} className={cn('rounded-md px-2.5 py-1 font-medium transition', lang === l ? 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white' : 'text-muted-foreground')}>
                {l === 'en' ? 'EN' : 'हिं'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-sm tabular-nums"><Clock className="h-4 w-4 text-muted-foreground" /> {mm}:{ss}</div>
          {violations > 0 && <div className="flex items-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-1.5 text-sm text-destructive"><ShieldAlert className="h-4 w-4" /> {violations}</div>}
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
            placeholder={lang === 'hi' ? 'अपना उत्तर लिखें, या बोलने के लिए माइक दबाएँ…' : 'Type your answer, or tap the mic to speak…'}
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
              <Button variant={listening ? 'primary' : 'glass'} size="sm" magnetic={false} onClick={toggleListening}>
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
