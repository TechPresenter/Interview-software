'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, CreditCard, Receipt, Shield, Settings, Bell, KeyRound, ScrollText, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/store/auth.store';

/** Dashboard top bar with the profile dropdown (Company + Admin + all roles). */
export function Topbar() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const role = user.role;
  const isAdmin = role === 'super_admin';
  const isCandidate = role === 'candidate';
  const billingHref = isAdmin ? '/dashboard/subscriptions' : '/dashboard/billing';

  const items = [
    { label: 'Profile Details', icon: User, href: isCandidate ? '/dashboard/profile' : '/dashboard/account' },
    { label: 'Account Settings', icon: Settings, href: '/dashboard/account' },
    { label: 'Security Center', icon: Shield, href: '/dashboard/account#security' },
    ...(!isCandidate ? [{ label: 'Billing', icon: CreditCard, href: billingHref }] : []),
    ...(!isCandidate ? [{ label: 'Subscription', icon: Receipt, href: billingHref }] : []),
    { label: 'Notifications', icon: Bell, href: isCandidate ? '/dashboard/my-interviews' : '/dashboard/account#notifications' },
    { label: 'API Keys', icon: KeyRound, href: isAdmin ? '/dashboard/ai' : '/dashboard/account#api' },
    { label: 'Activity Logs', icon: ScrollText, href: isAdmin ? '/dashboard/system' : '/dashboard/account#activity' },
  ];

  const initial = user.name?.[0]?.toUpperCase() || 'U';
  async function doLogout() {
    setOpen(false);
    await logout();
    router.replace('/login');
  }

  return (
    <div className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 border-b border-border bg-background/70 px-6 backdrop-blur-xl lg:px-10">
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5 transition hover:bg-muted/50"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-sm font-bold text-white">{initial}</span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight">{user.name}</span>
            <span className="block text-xs capitalize leading-tight text-muted-foreground">{role.replace('_', ' ')}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="glass-strong absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-border shadow-xl">
              <div className="border-b border-border px-4 py-3">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="py-1">
                {items.map((it) => (
                  <Link
                    key={it.label}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                  >
                    <it.icon className="h-4 w-4" /> {it.label}
                  </Link>
                ))}
              </div>
              <button
                onClick={doLogout}
                className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-sm text-destructive transition hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Topbar;
