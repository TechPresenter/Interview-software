'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const googleLogin = useAuth((s) => s.googleLogin);
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password, needs2fa ? form.otp : undefined);
      router.push('/dashboard');
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'TWO_FACTOR_REQUIRED') {
        setNeeds2fa(true);
      } else {
        setError(err?.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async (credential: string) => {
    setError('');
    try {
      await googleLogin(credential);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Google sign-in failed');
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-50" />
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="text-gradient">AIPL Hire</span>
        </Link>

        <GlassCard className="p-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="you@company.com"
              required
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
              placeholder="••••••••"
              required
            />
            {needs2fa && (
              <Field
                label="2FA code"
                value={form.otp}
                onChange={(v) => setForm((f) => ({ ...f, otp: v }))}
                placeholder="123456"
                required
              />
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" loading={loading} className="w-full" magnetic={false}>
              Sign in
            </Button>
          </form>

          <GoogleButton onCredential={onGoogle} />

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <Link href="/forgot-password" className="hover:text-foreground">Forgot password?</Link>
            <Link href="/register" className="hover:text-foreground">Create account</Link>
          </div>
        </GlassCard>
      </motion.div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
        {...rest}
      />
    </label>
  );
}
