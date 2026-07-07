import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Database,
  Bot,
  Settings,
  Newspaper,
  Palette,
  Briefcase,
  Users,
  CalendarClock,
  GitBranch,
  FileBarChart,
  User,
  CalendarCheck,
  Film,
  BookOpen,
  Mail,
  UserCog,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/store/auth.store';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Role-aware sidebar navigation. Mirrors the panels in the product spec. */
export const navByRole: Record<Role, NavItem[]> = {
  super_admin: [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Companies', href: '/dashboard/companies', icon: Building2 },
    { label: 'Candidates', href: '/dashboard/candidates', icon: Users },
    { label: 'Subscriptions', href: '/dashboard/subscriptions', icon: CreditCard },
    { label: 'Question Bank', href: '/dashboard/questions', icon: Database },
    { label: 'AI Management', href: '/dashboard/ai', icon: Bot },
    { label: 'Knowledge Base', href: '/dashboard/knowledge', icon: BookOpen },
    { label: 'Email', href: '/dashboard/email', icon: Mail },
    { label: 'Recordings', href: '/dashboard/recordings', icon: Film },
    { label: 'White Label', href: '/dashboard/branding', icon: Palette },
    { label: 'CMS', href: '/dashboard/cms', icon: Newspaper },
    { label: 'System', href: '/dashboard/system', icon: Settings },
  ],
  company_admin: [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Jobs', href: '/dashboard/jobs', icon: Briefcase },
    { label: 'Candidates', href: '/dashboard/candidates', icon: Users },
    { label: 'Interviews', href: '/dashboard/interviews', icon: CalendarClock },
    { label: 'Pipeline', href: '/dashboard/pipeline', icon: GitBranch },
    { label: 'Reports', href: '/dashboard/reports', icon: FileBarChart },
    { label: 'Knowledge Base', href: '/dashboard/knowledge', icon: BookOpen },
    { label: 'AI Interviewer', href: '/dashboard/interviewer', icon: Bot },
    { label: 'Recordings', href: '/dashboard/recordings', icon: Film },
    { label: 'Staff', href: '/dashboard/staff', icon: UserCog },
    { label: 'Roles', href: '/dashboard/roles', icon: ShieldCheck },
    { label: 'Email', href: '/dashboard/email-settings', icon: Mail },
    { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  ],
  recruiter: [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Jobs', href: '/dashboard/jobs', icon: Briefcase },
    { label: 'Candidates', href: '/dashboard/candidates', icon: Users },
    { label: 'Interviews', href: '/dashboard/interviews', icon: CalendarClock },
    { label: 'Pipeline', href: '/dashboard/pipeline', icon: GitBranch },
    { label: 'Recordings', href: '/dashboard/recordings', icon: Film },
    { label: 'Knowledge Base', href: '/dashboard/knowledge', icon: BookOpen },
  ],
  hr_manager: [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Interviews', href: '/dashboard/interviews', icon: CalendarClock },
    { label: 'Reports', href: '/dashboard/reports', icon: FileBarChart },
    { label: 'Recordings', href: '/dashboard/recordings', icon: Film },
    { label: 'Pipeline', href: '/dashboard/pipeline', icon: GitBranch },
    { label: 'Knowledge Base', href: '/dashboard/knowledge', icon: BookOpen },
  ],
  candidate: [
    { label: 'My Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Interviews', href: '/dashboard/my-interviews', icon: CalendarCheck },
    { label: 'Profile', href: '/dashboard/profile', icon: User },
  ],
};
