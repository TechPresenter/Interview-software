import type { ReactNode } from 'react';
import { CreditFooter } from '@/components/ui/CreditFooter';

/** Auth screens (login, register, forgot-password) share a subtle bottom credit. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-4">
        <div className="pointer-events-auto rounded-full bg-background/60 px-3 py-1 backdrop-blur">
          <CreditFooter />
        </div>
      </div>
    </>
  );
}
