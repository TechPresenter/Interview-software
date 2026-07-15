'use client';

import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, Bot, Check, CreditCard, Database, GitBranch, ListChecks, Lock, Mail, ShieldCheck, Sparkles, Users, Video,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Item, Stagger } from '@/components/ui/motion';

/** A category of platform capabilities, as served alongside GET /content/plans. */
export interface CapabilityGroup {
  /** Stable slug — selects the group's icon. Authored server-side. */
  key: string;
  label: string;
  items: { label: string; description?: string }[];
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  'ai-interviewing': Bot,
  'question-bank': ListChecks,
  candidates: GitBranch,
  proctoring: ShieldCheck,
  reports: BarChart3,
  recordings: Video,
  collaboration: Users,
  knowledge: Database,
  email: Mail,
  security: Lock,
  billing: CreditCard,
};

/** Groups are authored server-side, so an unrecognised slug must still render. */
const iconFor = (key: string) => GROUP_ICONS[key] ?? Sparkles;

/**
 * The full platform capability set, listed once rather than as a per-plan matrix.
 * Columns of ticks would re-imply that ticking is meaningful; every capability
 * here ships on every plan, so there is nothing to compare.
 */
export function IncludedFeatures({ groups }: { groups: CapabilityGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <Stagger className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => {
        const Icon = iconFor(g.key);
        return (
          <Item key={g.key}>
            <GlassCard className="h-full">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold">{g.label}</h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {g.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {/* The description explains the capability without turning 68
                        one-liners into an unscannable wall of prose. */}
                    <span title={item.description}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </Item>
        );
      })}
    </Stagger>
  );
}

export default IncludedFeatures;
