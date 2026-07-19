'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { OtpInput } from '@/components/ui/OtpInput';
import { AuthShell } from '@/components/auth/AuthShell';

type Step = 'request' | 'reset';

const RESEND_SECONDS = 60;

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
  const [cooldown, setCooldown] = useState(0);

  // Ticks the "Resend in Ns" counter down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setInfo('If that email exists, a 6-digit reset code is on its way. Check your inbox.');
      setStep('reset');
      setCooldown(RESEND_SECONDS);
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
      setCode(''); // a stale wrong code left in the boxes only invites a mixed retype
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
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
              <div>
                <p className="mb-2 text-sm font-medium">Reset code</p>
                <OtpInput value={code} onChange={setCode} disabled={loading} />
              </div>
              <Field label="New password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required autoComplete="new-password" />
              <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" required autoComplete="new-password" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" loading={loading} disabled={code.trim().length !== 6} className="w-full" magnetic={false}>Update password</Button>
              <div className="text-center text-sm text-muted-foreground">
                {cooldown > 0 ? (
                  <span>Didn&apos;t get a code? Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void requestCode()}
                    disabled={loading}
                    className="transition hover:text-foreground hover:underline"
                  >
                    Didn&apos;t get a code? Send again
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        </GlassCard>
    </AuthShell>
  );
}
