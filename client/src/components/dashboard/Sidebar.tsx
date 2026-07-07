'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, LogOut, PanelLeftClose, PanelLeft, X } from 'lucide-react';
import { navByRole } from './nav.config';
import { useAuth } from '@/store/auth.store';
import { useBranding } from '@/store/branding.store';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

interface SidebarProps {
  /** Whether the mobile drawer is open (controlled by the dashboard layout). */
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const branding = useBranding((s) => s.branding);
  const [collapsed, setCollapsed] = useState(false);
  const items = user ? navByRole[user.role] ?? [] : [];
  const name = branding?.platformName || SITE.name;

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const Brand = ({ hideLabel = false }: { hideLabel?: boolean }) => (
    <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden text-lg font-bold" aria-label={`${name} home`}>
      {branding?.logoUrl ? (
        <img src={`${API_ORIGIN}${branding.logoUrl}`} alt={name} className="h-9 w-9 shrink-0 rounded-xl object-contain" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
          <Sparkles className="h-5 w-5 text-white" />
        </span>
      )}
      {!hideLabel && <span className="text-gradient whitespace-nowrap">{name}</span>}
    </Link>
  );

  const NavItems = ({ collapsed: isCollapsed = false, useLayoutId = true }: { collapsed?: boolean; useLayoutId?: boolean }) => (
    <>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            {active && (
              useLayoutId ? (
                <motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-xl bg-primary/10 ring-1 ring-primary/30" transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
              ) : (
                <span className="absolute inset-0 -z-10 rounded-xl bg-primary/10 ring-1 ring-primary/30" />
              )
            )}
            <item.icon className={cn('h-5 w-5 shrink-0 transition-colors', active && 'text-primary')} />
            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </Link>
        );
      })}
    </>
  );

  const UserFooter = ({ collapsed: isCollapsed = false }: { collapsed?: boolean }) => (
    <div className="mt-auto space-y-2 pt-2">
      <div className={cn('flex items-center gap-2', isCollapsed && 'flex-col')}>
        <ThemeToggle />
        {!isCollapsed && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground lg:grid"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground lg:grid"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border p-3">
        {!isCollapsed && (
          <>
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">{user?.role?.replace('_', ' ')}</p>
          </>
        )}
        <button
          onClick={logout}
          title="Sign out"
          className={cn(
            'mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive',
            isCollapsed ? 'w-full justify-center' : 'w-full',
          )}
        >
          <LogOut className="h-4 w-4" /> {!isCollapsed && 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar (collapsible) ── */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 264 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card/50 p-3 backdrop-blur-xl lg:flex"
      >
        <div className="mb-6 flex items-center justify-between px-1">
          <Brand hideLabel={collapsed} />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <NavItems collapsed={collapsed} />
        </nav>
        <UserFooter collapsed={collapsed} />
      </motion.aside>

      {/* ── Mobile / tablet drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="absolute left-0 top-0 flex h-full w-[80vw] max-w-72 flex-col border-r border-border bg-card p-3 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between px-1">
                <Brand />
                <button
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto">
                <NavItems useLayoutId={false} />
              </nav>
              <UserFooter />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
