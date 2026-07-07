'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { KeyRound, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { adminApi } from '@/lib/admin.api';
import { companyApi } from '@/lib/company.api';
import { date } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CodeBlock } from '@/components/public/CodeBlock';
import { toast } from '@/components/ui/toast';

export default function ApiKeysPage() {
  const role = useAuth((s) => s.user?.role);
  if (role === 'super_admin') return <AdminProviderKeys />;
  if (role === 'company_admin') return <CompanyApiKeys />;
  return (
    <div className="space-y-8">
      <PageHeader title="API Keys" description="Integration keys for the REST API." />
      <GlassCard>
        <p className="text-sm text-muted-foreground">API keys are managed by your company administrator.</p>
      </GlassCard>
    </div>
  );
}

/** Company admins: generate + manage integration API keys. */
function CompanyApiKeys() {
  const qc = useQueryClient();
  const { data: keys = [], isLoading } = useQuery({ queryKey: ['company-api-keys'], queryFn: companyApi.apiKeys });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const closeModal = () => { setOpen(false); setNewKey(null); setName(''); };

  const create = async () => {
    if (name.trim().length < 2) { toast.error('Give the key a name.'); return; }
    setCreating(true);
    try {
      const res: any = await companyApi.createApiKey({ name: name.trim() });
      setNewKey(res.key);
      qc.invalidateQueries({ queryKey: ['company-api-keys'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not create key');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this key? Any app using it will immediately stop working.')) return;
    try {
      await companyApi.revokeApiKey(id);
      toast.success('API key revoked');
      qc.invalidateQueries({ queryKey: ['company-api-keys'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not revoke');
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="API Keys"
        description="Generate and manage keys to integrate with the REST API."
        action={<Button magnetic={false} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Generate key</Button>}
      />

      <GlassCard>
        <div className="mb-4 flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Your API keys</h2></div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && keys.length === 0 && (
          <p className="text-sm text-muted-foreground">No API keys yet. Generate one to start building integrations.</p>
        )}
        <div className="space-y-2">
          {keys.map((k: any) => (
            <div key={k._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{k.prefix}••••{k.last4}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {(k.scopes ?? []).map((s: string) => <Badge key={s} tone="muted">{s}</Badge>)}
                <span className="text-xs text-muted-foreground">Created {date(k.createdAt)}</span>
                <button onClick={() => revoke(k._id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive transition hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="font-semibold">Using your API key</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Send it as a Bearer token on every request. See the{' '}
          <Link href="/api-docs" className="text-primary hover:underline">API documentation</Link> for endpoints and examples.
        </p>
        <CodeBlock label="Authorization header">{`Authorization: Bearer aipl_live_xxxxxxxxxxxxxxxx`}</CodeBlock>
      </GlassCard>

      <Modal
        open={open}
        onClose={closeModal}
        title={newKey ? 'API key created' : 'Generate API key'}
        description={newKey ? undefined : 'Give your key a memorable name (e.g. the app or server that will use it).'}
        footer={
          newKey ? (
            <Button magnetic={false} onClick={closeModal}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" magnetic={false} onClick={closeModal}>Cancel</Button>
              <Button magnetic={false} loading={creating} onClick={create}>Generate</Button>
            </>
          )
        }
      >
        {newKey ? (
          <div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-500">
              <ShieldAlert className="h-4 w-4 shrink-0" /> Copy this key now — for security it cannot be shown again.
            </div>
            <CodeBlock label="Your new API key">{newKey}</CodeBlock>
          </div>
        ) : (
          <div>
            <label htmlFor="key-name" className="mb-1 block text-sm font-medium">Key name</label>
            <input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production server"
              className="h-11 w-full rounded-xl border border-input bg-card/60 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Super admins keep the AI provider key overview. */
function AdminProviderKeys() {
  const { data } = useQuery({ queryKey: ['ai-providers'], queryFn: adminApi.aiProviders });
  const providers = data?.providers ?? [];
  return (
    <div className="space-y-8">
      <PageHeader title="API Keys" description="AI provider keys and integrations." />
      <GlassCard>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI provider keys</h2>
          <Link href="/dashboard/ai" className="ml-auto"><Button size="sm" magnetic={false}>Manage in AI Management</Button></Link>
        </div>
        {providers.length === 0 && <p className="text-sm text-muted-foreground">No providers configured. The built-in key from your server environment is used by default.</p>}
        <div className="space-y-2">
          {providers.map((p: any) => (
            <div key={p._id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              <span className="font-medium">{p.label} <span className="ml-1 text-xs uppercase text-muted-foreground">{p.type}</span></span>
              <div className="flex gap-2">
                <Badge tone={p.hasKey ? 'success' : 'warning'}>{p.hasKey ? 'key set' : 'no key'}</Badge>
                {p.isDefault && <Badge tone="default">default</Badge>}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
