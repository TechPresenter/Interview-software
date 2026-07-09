'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { roomApi } from '@/lib/room.api';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

// Camera / mic / MediaRecorder / SpeechSynthesis are browser-only — never SSR them.
const PreCheck = dynamic(() => import('@/components/room/PreCheck').then((m) => m.PreCheck), {
  ssr: false,
  loading: () => <RoomLoader />,
});
const InterviewRoom = dynamic(() => import('@/components/room/InterviewRoom').then((m) => m.InterviewRoom), {
  ssr: false,
  loading: () => <RoomLoader />,
});

function RoomLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Loader2 className="h-9 w-9 animate-spin text-primary" />
    </div>
  );
}

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token);

  const [room, setRoom] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    roomApi
      .get(token)
      .then(setRoom)
      .catch((e) => setError(e?.response?.data?.message || 'This interview could not be loaded'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <main className="relative min-h-screen overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-30" />

      <header className="mx-auto mb-8 flex max-w-6xl items-center gap-2 text-lg font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
          <Sparkles className="h-5 w-5 text-white" />
        </span>
        <span className="text-gradient">{room?.interviewer?.name || 'AIPL Hire'}</span>
      </header>

      {loading && (
        <div className="grid min-h-[50vh] place-items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {!loading && error && (
        <div className="grid min-h-[50vh] place-items-center text-center">
          <div className="glass max-w-md rounded-2xl p-8">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-xl font-bold">Unable to start</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {!loading && room && room.status === 'completed' && (
        <div className="grid min-h-[50vh] place-items-center text-center">
          <div className="glass max-w-md rounded-2xl p-8">
            <h1 className="text-2xl font-bold">This interview is complete</h1>
            <p className="mt-2 text-sm text-muted-foreground">Thanks — your responses were already submitted.</p>
            <Button className="mx-auto mt-6" magnetic={false} onClick={() => router.push('/')}>Go home</Button>
          </div>
        </div>
      )}

      {!loading && room && room.status !== 'completed' && !started && (
        <PreCheck jobTitle={room.job?.title || 'the role'} onReady={(s) => { setStream(s); setStarted(true); }} />
      )}

      {!loading && room && started && (
        <InterviewRoom
          token={token}
          durationMinutes={room.config?.durationMinutes || 30}
          stream={stream}
          onDone={() => router.push('/')}
          initialLanguage={room.config?.language === 'hi' ? 'hi' : 'en'}
          allowLanguageChange={room.config?.allowLanguageChange ?? false}
          allowSkip={room.config?.allowSkip ?? true}
          initialSkips={room.skips?.remaining ?? room.config?.maxSkips ?? 0}
          interviewer={room.interviewer ? { ...room.interviewer, avatarUrl: room.interviewer.avatarUrl ? `${API_ORIGIN}${room.interviewer.avatarUrl}` : null } : undefined}
        />
      )}
    </main>
  );
}
