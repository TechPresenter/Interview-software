'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AuthShell } from '@/components/auth/AuthShell';
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
    <AuthShell>
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

            <Button type="submit" loading={loading} className="w-full" magnetic={false} data-cta="signup_submit">
              Create account
            </Button>
          </form>

          <GoogleButton onCredential={onGoogle} />

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground hover:underline">Sign in</Link>
          </p>
        </GlassCard>
    </AuthShell>
  );
}
