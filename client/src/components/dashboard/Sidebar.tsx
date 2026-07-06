'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, LogOut, PanelLeftClose, PanelLeft } from 'lucide-react';
import { navByRole } from './nav.config';
import { useAuth } from '@/store/auth.store';
import { useBranding } from '@/store/branding.store';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const branding = useBranding((s) => s.branding);
  const [collapsed, setCollapsed] = useState(false);
  const items = user ? navByRole[user.role] : [];
  const name = branding?.platformName || SITE.name;

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 264 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card/50 p-3 backdrop-blur-xl lg:flex"
    >
      <div className="mb-6 flex items-center justify-between px-1">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden text-lg font-bold">
          {branding?.logoUrl ? (
            <img src={`${API_ORIGIN}${branding.logoUrl}`} alt={name} className="h-9 w-9 shrink-0 rounded-xl object-contain" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
          )}
          {!collapsed && <span className="text-gradient whitespace-nowrap">{name}</span>}
        </Link>
      </div>

      <nav className="flex-1 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {active && (
                <motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-xl bg-primary/10 ring-1 ring-primary/30" transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
              )}
              <item.icon className={cn('h-5 w-5 shrink-0 transition-colors', active && 'text-primary')} />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2">
        <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
          <ThemeToggle />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        </div>

        <div className="rounded-xl border border-border p-3">
          {!collapsed && (
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
              collapsed ? 'w-full justify-center' : 'w-full',
            )}
          >
            <LogOut className="h-4 w-4" /> {!collapsed && 'Sign out'}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

export default Sidebar;
