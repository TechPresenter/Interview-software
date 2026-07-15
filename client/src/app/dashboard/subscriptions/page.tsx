'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Sparkles, Pencil } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { money, date } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/components/ui/toast';

const tabs = ['Plans', 'Coupons', 'Invoices'] as const;
type Tab = (typeof tabs)[number];

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('Plans');
  return (
    <div>
      <PageHeader title="Subscriptions" description="Plans, coupons, and invoices across the platform." />
      <div className="mb-6 inline-flex gap-1 rounded-xl border border-border p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              tab === t ? 'bg-gradient-brand text-white shadow-glow' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Plans' && <Plans />}
      {tab === 'Coupons' && <Coupons />}
      {tab === 'Invoices' && <Invoices />}
    </div>
  );
}

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP'];
const emptyPlanForm = {
  key: 'starter', name: '', monthly: 0, yearly: 0, currency: 'USD',
  seats: 5, activeJobs: 5, interviewsPerMonth: 100, aiTokensPerMonth: 1000000,
  features: '', isPopular: false, isActive: true,
};

function Plans() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['plans'], queryFn: adminApi.plans });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<typeof emptyPlanForm>(emptyPlanForm);

  const seed = useMutation({
    mutationFn: adminApi.seedPlans,
    onSuccess: () => { toast.success('Default plans created'); qc.invalidateQueries({ queryKey: ['plans'] }); },
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      key: p.key,
      name: p.name || '',
      monthly: Math.round((p.pricing?.monthly || 0) / 100),
      yearly: Math.round((p.pricing?.yearly || 0) / 100),
      currency: p.pricing?.currency || 'USD',
      seats: p.limits?.seats ?? 5,
      activeJobs: p.limits?.activeJobs ?? 5,
      interviewsPerMonth: p.limits?.interviewsPerMonth ?? 100,
      aiTokensPerMonth: p.limits?.aiTokensPerMonth ?? 1000000,
      features: (p.features ?? []).join('\n'),
      isPopular: !!p.isPopular,
      isActive: p.isActive !== false,
    });
  };

  const save = useMutation({
    mutationFn: () =>
      adminApi.upsertPlan({
        key: form.key,
        name: form.name,
        pricing: { monthly: Math.round(Number(form.monthly) * 100), yearly: Math.round(Number(form.yearly) * 100), currency: form.currency },
        limits: {
          seats: Number(form.seats), activeJobs: Number(form.activeJobs),
          interviewsPerMonth: Number(form.interviewsPerMonth), aiTokensPerMonth: Number(form.aiTokensPerMonth),
        },
        features: form.features.split('\n').map((s) => s.trim()).filter(Boolean),
        isPopular: form.isPopular,
        isActive: form.isActive,
      }),
    onSuccess: () => { toast.success('Plan saved'); setEditing(null); qc.invalidateQueries({ queryKey: ['plans'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Set pricing and usage limits per tier. Every platform feature is included in every plan —
          tiers differ by how much, never by what.
        </p>
        {(data?.length ?? 0) === 0 && !isLoading && (
          <Button size="sm" magnetic={false} loading={seed.isPending} onClick={() => seed.mutate()}>
            <Sparkles className="h-4 w-4" /> Seed default tiers
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {(data ?? []).map((p: any) => (
            <GlassCard key={p._id} className={cn('flex flex-col', p.isPopular && 'ring-1 ring-primary/40')}>
              <div className="flex items-start justify-between">
                <div>
                  {p.isPopular && <Badge className="mb-2">Most popular</Badge>}
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{p.key}</p>
                </div>
                <button onClick={() => openEdit(p)} title="Customize" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-3xl font-bold text-gradient">
                {p.pricing.monthly ? money(p.pricing.monthly, p.pricing.currency) : 'Custom'}
                {p.pricing.monthly ? <span className="text-sm text-muted-foreground">/mo</span> : null}
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                {(p.features ?? []).slice(0, 5).map((f: string) => <li key={f}>• {f}</li>)}
              </ul>
              <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                {p.limits.seats} seats · {p.limits.interviewsPerMonth} interviews/mo
                {p.isActive === false && <Badge tone="muted" className="ml-2">inactive</Badge>}
              </div>
              <Button variant="glass" size="sm" magnetic={false} className="mt-4" onClick={() => openEdit(p)}>
                <Pencil className="h-4 w-4" /> Customize
              </Button>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Customize ${editing?.name ?? 'plan'}`}
        footer={<><Button variant="ghost" magnetic={false} onClick={() => setEditing(null)}>Cancel</Button><Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>Save plan</Button></>}
      >
        <div className="space-y-4">
          <Field label="Plan name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Monthly price" type="number" value={String(form.monthly)} onChange={(v) => setForm((f) => ({ ...f, monthly: Number(v) }))} />
            <Field label="Yearly price" type="number" value={String(form.yearly)} onChange={(v) => setForm((f) => ({ ...f, yearly: Number(v) }))} />
            <Select label="Currency" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v }))} options={CURRENCIES.map((c) => ({ label: c, value: c }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seats" type="number" value={String(form.seats)} onChange={(v) => setForm((f) => ({ ...f, seats: Number(v) }))} />
            <Field label="Active jobs" type="number" value={String(form.activeJobs)} onChange={(v) => setForm((f) => ({ ...f, activeJobs: Number(v) }))} />
            <Field label="Interviews / month" type="number" value={String(form.interviewsPerMonth)} onChange={(v) => setForm((f) => ({ ...f, interviewsPerMonth: Number(v) }))} />
            <Field label="AI tokens / month" type="number" value={String(form.aiTokensPerMonth)} onChange={(v) => setForm((f) => ({ ...f, aiTokensPerMonth: Number(v) }))} />
          </div>
          <Textarea
            label="Plan highlights (one per line)"
            value={form.features}
            onChange={(v) => setForm((f) => ({ ...f, features: v }))}
            rows={5}
            placeholder={'100 AI interviews / month\n10 active jobs\n5 team members\nEvery platform feature included'}
          />
          {/* Labelled "Features" before, which read as a capability list and is how
              the pricing page ended up implying gates nothing enforces. These are
              the tier's quotas — capability is universal. */}
          <p className="-mt-2 text-xs text-muted-foreground">
            Shown on the pricing and billing cards. Describe this tier&apos;s quotas — not what it can do.
            Listing a capability here implies other tiers lack it, and nothing in the product enforces that.
          </p>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPopular} onChange={(e) => setForm((f) => ({ ...f, isPopular: e.target.checked }))} className="accent-[hsl(var(--primary))]" /> Mark as popular</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-[hsl(var(--primary))]" /> Active</label>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Coupons() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'percent', value: 10 });

  const { data, isLoading } = useQuery({
    queryKey: ['coupons', page],
    queryFn: () => adminApi.coupons({ page, limit: 10 }),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createCoupon({ ...form, value: Number(form.value) }),
    onSuccess: () => {
      toast.success('Coupon created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deleted');
      qc.invalidateQueries({ queryKey: ['coupons'] });
    },
  });

  const columns: Column<any>[] = [
    { key: 'code', header: 'Code', render: (r) => <span className="font-mono font-medium">{r.code}</span> },
    { key: 'value', header: 'Discount', render: (r) => (r.type === 'percent' ? `${r.value}%` : money(r.value, r.currency)) },
    { key: 'redemptions', header: 'Used', render: (r) => `${r.redemptions}${r.maxRedemptions ? ` / ${r.maxRedemptions}` : ''}` },
    { key: 'isActive', header: 'Status', render: (r) => <Badge tone={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'active' : 'inactive'}</Badge> },
    { key: 'validUntil', header: 'Expires', render: (r) => date(r.validUntil) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <button onClick={() => del.mutate(r._id)} className="text-destructive hover:text-destructive/80">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" magnetic={false} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        rowKey={(r) => r._id}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create coupon"
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
            <Button magnetic={false} loading={create.isPending} onClick={() => create.mutate()}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Code" value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))} />
          <Select
            label="Type"
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={[
              { label: 'Percent (%)', value: 'percent' },
              { label: 'Fixed amount', value: 'amount' },
            ]}
          />
          <Field
            label={form.type === 'percent' ? 'Percent off' : 'Amount off (minor units)'}
            type="number"
            value={String(form.value)}
            onChange={(v) => setForm((f) => ({ ...f, value: Number(v) }))}
          />
        </div>
      </Modal>
    </div>
  );
}

function Invoices() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page],
    queryFn: () => adminApi.invoices({ page, limit: 10 }),
  });

  const columns: Column<any>[] = [
    { key: 'invoiceNumber', header: 'Invoice', render: (r) => r.invoiceNumber || r.providerPaymentId || '—' },
    { key: 'company', header: 'Company', render: (r) => r.company?.name ?? '—' },
    { key: 'amount', header: 'Amount', render: (r) => money(r.amount, r.currency) },
    { key: 'provider', header: 'Provider', render: (r) => <Badge tone="info">{r.provider}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'createdAt', header: 'Date', render: (r) => date(r.createdAt) },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data?.items ?? []}
      loading={isLoading}
      emptyText="No invoices yet"
      rowKey={(r) => r._id}
      page={data?.meta.page}
      pages={data?.meta.pages}
      total={data?.meta.total}
      onPageChange={setPage}
    />
  );
}
