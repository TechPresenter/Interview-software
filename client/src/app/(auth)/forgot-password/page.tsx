'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, ArrowLeft, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

type Step = 'request' | 'reset';

/**
 * Forgot / reset password flow.
 *  1. Request a reset code by email  → POST /auth/forgot-password
 *  2. Enter the code + a new password → POST /auth/reset-password → /login
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setInfo('If that email exists, a 6-digit reset code is on its way. Check your inbox.');
      setStep('reset');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send the reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code: code.trim(), password });
      router.push('/login?reset=1');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold">{step === 'request' ? 'Reset your password' : 'Enter your reset code'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 'request'
              ? 'Enter your account email and we’ll send you a reset code.'
              : 'Paste the code from your email and choose a new password.'}
          </p>

          {info && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-accent/10 px-3 py-2.5 text-sm text-foreground">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {info}
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={requestCode} className="mt-6 space-y-4">
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" required autoComplete="email" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" loading={loading} className="w-full" magnetic={false}>Send reset code</Button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="mt-6 space-y-4">
              <Field label="Reset code" value={code} onChange={setCode} placeholder="123456" inputMode="numeric" required />
              <Field label="New password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required autoComplete="new-password" />
              <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" required autoComplete="new-password" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" loading={loading} className="w-full" magnetic={false}>Update password</Button>
              <button
                type="button"
                onClick={() => { setStep('request'); setError(''); }}
                className="w-full text-center text-sm text-muted-foreground transition hover:text-foreground"
              >
                Didn’t get a code? Send again
              </button>
            </form>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
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
