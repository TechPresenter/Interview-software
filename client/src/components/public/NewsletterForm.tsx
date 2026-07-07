'use client';

import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { marketingApi } from '@/lib/marketing.api';

/** Newsletter opt-in — persists to the backend (manageable in the Admin Panel). */
export function NewsletterForm({ className }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await marketingApi.newsletter(email);
      setDone(true);
      toast.success('You are subscribed — welcome aboard!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not subscribe. Please try again.');
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
    <form onSubmit={submit} className={`flex w-full max-w-md gap-2 ${className ?? ''}`} noValidate>
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <input
        id="nl-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="h-11 flex-1 rounded-xl border border-input bg-card/60 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
      />
      <Button type="submit" loading={loading} magnetic={false}>
        Subscribe <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}

export default NewsletterForm;
