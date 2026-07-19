'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { OtpInput } from '@/components/ui/OtpInput';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AuthShell } from '@/components/auth/AuthShell';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';

type Role = 'company_admin' | 'candidate';
/**
 * details → the signup form; verify → the emailed 6-digit code. The account
 * only exists once the code is accepted, so leaving mid-verify abandons the
 * signup (it expires server-side in 15 minutes) rather than orphaning one.
 */
type Step = 'details' | 'verify';

const RESEND_SECONDS = 60;

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuth((s) => s.register);
  const verifyRegistration = useAuth((s) => s.verifyRegistration);
  const googleLogin = useAuth((s) => s.googleLogin);

  const [step, setStep] = useState<Step>('details');
  const [role, setRole] = useState<Role>('company_admin');
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Ticks the "Resend in Ns" counter down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendCode = async () => {
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
      setCode('');
      setStep('verify');
      setCooldown(RESEND_SECONDS);
    } catch (err: any) {
      // Resubmitting inside the send window is a 200 ("code already sent"), so
      // any error here is a real one (email taken, validation, rate limit).
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCode();
  };

  const onVerify = async (value?: string) => {
    const otp = (value ?? code).trim();
    if (otp.length !== 6 || loading) return;
    setError('');
    setLoading(true);
    try {
      await verifyRegistration(form.email, otp);
      router.push('/dashboard');
    } catch (err: any) {
      const apiCode = err?.response?.data?.code;
      setError(err?.response?.data?.message || 'Verification failed');
      // Always empty the boxes on failure: leaving a full wrong code in place
      // means the next keystroke re-completes it and re-submits the mix of old
      // and new digits mid-typing.
      setCode('');
      if (apiCode === 'REGISTRATION_EXPIRED') {
        // The staged signup timed out — walk them back to the form.
        setStep('details');
      }
      setLoading(false);
      return;
    }
    setLoading(false);
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
          {step === 'details' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <MailCheck className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold">Verify your email</h1>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit code to <span className="font-medium text-foreground">{form.email}</span>
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); void onVerify(); }}
                className="mt-6 space-y-4"
              >
                <OtpInput value={code} onChange={setCode} onComplete={(c) => void onVerify(c)} disabled={loading} />

                {error && <p className="text-center text-sm text-destructive">{error}</p>}

                <Button type="submit" loading={loading} disabled={code.trim().length !== 6} className="w-full" magnetic={false}>
                  Verify &amp; create account
                </Button>
              </form>

              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => { setStep('details'); setError(''); setCode(''); }}
                  className="hover:text-foreground hover:underline"
                >
                  ← Edit details
                </button>
                {cooldown > 0 ? (
                  <span>Resend in {cooldown}s</span>
                ) : (
                  <button type="button" onClick={() => void sendCode()} disabled={loading} className="text-foreground hover:underline">
                    Resend code
                  </button>
                )}
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                The code expires in 15 minutes. Check your spam folder if it doesn&apos;t arrive.
              </p>
            </>
          )}
        </GlassCard>
    </AuthShell>
  );
}
