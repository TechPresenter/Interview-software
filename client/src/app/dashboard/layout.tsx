'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { Toaster } from '@/components/ui/toast';
import { CreditFooter } from '@/components/ui/CreditFooter';
import { useAuth } from '@/store/auth.store';

/** Protected shell: redirects unauthenticated users to /login. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-30" />
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-6 lg:p-10">
          {children}
          <footer className="mt-10 border-t border-border pt-6">
            <CreditFooter className="justify-center sm:justify-start" />
          </footer>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
