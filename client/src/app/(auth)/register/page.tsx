'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';

type Role = 'company_admin' | 'candidate';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuth((s) => s.register);
  const googleLogin = useAuth((s) => s.googleLogin);
  const [role, setRole] = useState<Role>('company_admin');
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role,
        companyName: role === 'company_admin' ? form.companyName : undefined,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async (credential: string) => {
    setError('');
    try {
      await googleLogin(credential, role);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Google sign-up failed');
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-50" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 aurora opacity-55" />
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="text-gradient">AIPL Hire</span>
        </Link>

        <GlassCard className="p-8">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start hiring with AI in minutes</p>

          {/* Role toggle */}
          <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-border p-1">
            {(['company_admin', 'candidate'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  'rounded-lg py-2 text-sm font-medium transition',
                  role === r ? 'bg-gradient-brand text-white shadow-glow' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r === 'company_admin' ? "I'm hiring" : "I'm a candidate"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Full name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
            {role === 'company_admin' && (
              <Field
                label="Company name"
                value={form.companyName}
                onChange={(v) => setForm((f) => ({ ...f, companyName: v }))}
                required
              />
            )}
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
            <Field label="Password" type="password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} required />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" loading={loading} className="w-full" magnetic={false}>
              Create account
            </Button>
          </form>

          <GoogleButton onCredential={onGoogle} />

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground hover:underline">Sign in</Link>
          </p>
        </GlassCard>
      </motion.div>
    </main>
  );
}
