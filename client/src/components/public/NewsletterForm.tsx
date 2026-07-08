'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { marketingApi, type CaptchaConfig } from '@/lib/marketing.api';
import { Captcha, type CaptchaHandle } from '@/components/public/Captcha';

/** Newsletter opt-in — persists to the backend (manageable in the Admin Panel). */
export function NewsletterForm({ className }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const [captchaCfg, setCaptchaCfg] = useState<CaptchaConfig | null>(null);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  const captchaRef = useRef<CaptchaHandle>(null);
  useEffect(() => {
    marketingApi.captcha().then(setCaptchaCfg).catch(() => setCaptchaCfg(null));
  }, []);
  const captchaOn = !!captchaCfg?.enabled && captchaCfg.provider !== 'none' && (captchaCfg.forms?.includes('newsletter') ?? true);
  const needsInteractiveCaptcha = captchaOn && captchaCfg?.provider !== 'recaptcha_v3';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (needsInteractiveCaptcha && !captchaSolved) {
      toast.error('Please complete the CAPTCHA to continue.');
      return;
    }
    setLoading(true);
    try {
      const captchaToken = captchaOn ? await captchaRef.current?.getToken() : undefined;
      await marketingApi.newsletter(email, { captchaToken: captchaToken || undefined, company_website: website });
      setDone(true);
      toast.success('You are subscribed — welcome aboard!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not subscribe. Please try again.');
      captchaRef.current?.reset();
      setCaptchaSolved(false);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <p className={`inline-flex items-center gap-2 text-sm text-accent ${className ?? ''}`}>
        <CheckCircle2 className="h-4 w-4" /> Thanks for subscribing!
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={`w-full max-w-md ${className ?? ''}`} noValidate>
      <div className="flex w-full gap-2">
        <label htmlFor="nl-email" className="sr-only">Email address</label>
        <input
          id="nl-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-11 flex-1 rounded-xl border border-input bg-card/60 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
        />
        {/* Honeypot */}
        <input
          type="text" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden
          value={website} onChange={(e) => setWebsite(e.target.value)}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />
        <Button type="submit" loading={loading} magnetic={false} disabled={needsInteractiveCaptcha && !captchaSolved}>
          Subscribe <Send className="h-4 w-4" />
        </Button>
      </div>
      {captchaOn && captchaCfg && (
        <div className="mt-3">
          <Captcha ref={captchaRef} provider={captchaCfg.provider} siteKey={captchaCfg.siteKey} onSolvedChange={setCaptchaSolved} />
        </div>
      )}
    </form>
  );
}

export default NewsletterForm;
