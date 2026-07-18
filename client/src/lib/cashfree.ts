/**
 * Cashfree Checkout (JS SDK v3) loader for the public application-fee flow.
 *
 * Loaded on demand — only an applicant who is actually paying pulls the script,
 * so the rest of the marketing site never carries it. `redirectTarget: '_self'`
 * sends the whole tab to Cashfree's hosted page and returns it to the order's
 * return_url (…/apply/status?code=…); no iframe, which is what makes it work on
 * a phone. The browser coming back is NEVER treated as proof of payment — the
 * signed webhook is, and the status page reconciles against the gateway.
 */

const SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js';

type CashfreeInstance = { checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown> };
type CashfreeFactory = (opts: { mode: 'sandbox' | 'production' }) => CashfreeInstance;

declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Payment SDK needs a browser'));
  if (window.Cashfree) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const el = existing || Object.assign(document.createElement('script'), { src: SRC, async: true });
    el.addEventListener('load', () => resolve());
    // Reset the memo so a later attempt can retry instead of resolving a dead script.
    el.addEventListener('error', () => {
      loader = null;
      reject(new Error('Could not load the payment provider. Check your connection and try again.'));
    });
    if (!existing) document.head.appendChild(el);
  });
  return loader;
}

/** Open Cashfree Checkout for a payment session, redirecting the current tab. */
export async function openCashfreeCheckout(paymentSessionId: string, mode: 'sandbox' | 'production'): Promise<void> {
  await loadScript();
  const factory = window.Cashfree;
  if (!factory) throw new Error('Payment provider is unavailable right now. Please try again shortly.');
  const cashfree = factory({ mode });
  await cashfree.checkout({ paymentSessionId, redirectTarget: '_self' });
}

export default openCashfreeCheckout;
