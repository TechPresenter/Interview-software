'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/store/auth.store';

/**
 * The ?reset=1 arrival from a completed password reset. Its own component
 * inside <Suspense> because useSearchParams requires a boundary and one banner
 * shouldn't de-opt the whole login page.
 */
function ResetNotice() {
  const reset = useSearchParams().get('reset');
  if (reset !== '1') return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-accent/10 px-3 py-2.5 text-sm text-foreground">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      Your password has been updated — sign in with the new one.
    </div>
  );
}

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
    <AuthShell>
        <GlassCard className="p-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>

          <Suspense fallback={null}>
            <ResetNotice />
          </Suspense>

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

            <Button type="submit" loading={loading} className="w-full" magnetic={false} data-cta="login_submit">
              Sign in
            </Button>
          </form>

          <GoogleButton onCredential={onGoogle} />

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <Link href="/forgot-password" className="hover:text-foreground">Forgot password?</Link>
            <Link href="/register" className="hover:text-foreground">Create account</Link>
          </div>
        </GlassCard>
    </AuthShell>
  );
}
