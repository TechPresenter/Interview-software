'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { setUnauthorizedHandler } from '@/lib/api';
import { useAuth } from '@/store/auth.store';
import { useTheme } from '@/store/theme.store';
import { useBranding } from '@/store/branding.store';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { TrackingScripts } from '@/components/TrackingScripts';
import { PageTracker } from '@/components/PageTracker';
import { EventTracker } from '@/components/EventTracker';
import { Toaster } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const initTheme = useTheme((s) => s.init);
  const loadBranding = useBranding((s) => s.load);

  useEffect(() => {
    initTheme();
    loadBranding();
    setUnauthorizedHandler(() => router.push('/login'));
    hydrate();
  }, [hydrate, router, initTheme, loadBranding]);

  return (
    <QueryClientProvider client={client}>
      <AnnouncementBar />
      {children}
      <Toaster />
      <TrackingScripts />
      <PageTracker />
      <EventTracker />
    </QueryClientProvider>
  );
}

export default Providers;
