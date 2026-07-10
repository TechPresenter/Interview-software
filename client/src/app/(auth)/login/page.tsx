'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AuthShell } from '@/components/auth/AuthShell';
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
    <AuthShell>
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
