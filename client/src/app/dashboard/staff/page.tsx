'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Clock } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { dateTime, relativeTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

const BASE_ROLES = [
  { label: 'Company Admin', value: 'company_admin' },
  { label: 'Recruiter', value: 'recruiter' },
  { label: 'HR Manager', value: 'hr_manager' },
];

export default function StaffPage() {
  const qc = useQueryClient();
  const { data: staff, isLoading } = useQuery({ queryKey: ['staff'], queryFn: companyApi.staff });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: companyApi.roles });
  const { data: history } = useQuery({ queryKey: ['login-history'], queryFn: companyApi.loginHistory });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'recruiter', customRole: '' });

  const roleOptions = [{ label: 'No custom role', value: '' }, ...((roles ?? []).map((r: any) => ({ label: r.name, value: r._id })))];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff'] });

  const add = useMutation({
    mutationFn: () => companyApi.addStaff({ ...form, customRole: form.customRole || undefined }),
    onSuccess: (r: any) => {
      invalidate();
      setOpen(false);
      setForm({ name: '', email: '', role: 'recruiter', customRole: '' });
      if (r?.tempPassword) {
        toast.success('Staff member added — temporary password copied to clipboard.');
        navigator.clipboard?.writeText(r.tempPassword).catch(() => {});
      } else toast.success('Staff member added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not add staff'),
  });

  const upd = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => companyApi.updateStaff(id, body),
    onSuccess: () => { invalidate(); toast.success('Updated'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => companyApi.removeStaff(id),
    onSuccess: () => { invalidate(); toast.success('Removed'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Remove failed'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & access"
        description="Invite teammates, assign roles, and review sign-in activity."
        action={<Button size="sm" magnetic={false} onClick={() => setOpen((o) => !o)}><UserPlus className="h-4 w-4" /> Add staff</Button>}
      />

      {open && (
        <GlassCard>
          <h2 className="text-lg font-semibold">Invite a staff member</h2>
          <p className="mt-1 text-sm text-muted-foreground">They’ll get a temporary password by email; it’s also copied for you to share.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Full name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Jane Doe" />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="jane@company.com" />
            <Select label="Base role" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={BASE_ROLES} />
            <Select label="Custom role" value={form.customRole} onChange={(v) => setForm((f) => ({ ...f, customRole: v }))} options={roleOptions} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" magnetic={false} loading={add.isPending} disabled={!form.name || !form.email} onClick={() => add.mutate()}>Send invite</Button>
            <Button size="sm" variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-3">Member</th>
              <th className="pb-3">Base role</th>
              <th className="pb-3">Custom role</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Last login</th>
              <th className="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && (staff ?? []).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No staff yet.</td></tr>}
            {(staff ?? []).map((s: any) => (
              <tr key={s._id} className="border-b border-border/50 last:border-0">
                <td className="py-3">
                  <p className="font-medium">{s.name} {s.isOwner && <Badge tone="success">Owner</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </td>
                <td className="py-3">
                  {s.isOwner ? (
                    <span className="capitalize text-muted-foreground">{s.role?.replace('_', ' ')}</span>
                  ) : (
                    <Select value={s.role} onChange={(v) => upd.mutate({ id: s._id, body: { role: v } })} options={BASE_ROLES} />
                  )}
                </td>
                <td className="py-3">
                  {s.isOwner ? <span className="text-muted-foreground">—</span> : (
                    <Select value={s.customRole?._id ?? s.customRole ?? ''} onChange={(v) => upd.mutate({ id: s._id, body: { customRole: v || null } })} options={roleOptions} />
                  )}
                </td>
                <td className="py-3">
                  <button
                    disabled={s.isOwner}
                    onClick={() => upd.mutate({ id: s._id, body: { isActive: !s.isActive } })}
                    className="disabled:opacity-50"
                  >
                    <Badge tone={s.isActive ? 'success' : 'danger'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                  </button>
                </td>
                <td className="py-3 text-muted-foreground">{s.lastLoginAt ? relativeTime(s.lastLoginAt) : 'Never'}</td>
                <td className="py-3 text-right">
                  {!s.isOwner && (
                    <button
                      onClick={() => { if (window.confirm(`Remove ${s.name}?`)) del.mutate(s._id); }}
                      className="text-destructive hover:text-destructive/80"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Login history</h2>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {(history ?? []).length === 0 && <p className="text-sm text-muted-foreground">No sign-in activity yet.</p>}
          {(history ?? []).map((h: any) => (
            <div key={h._id} className="flex items-center justify-between border-b border-border/40 pb-2 text-sm last:border-0">
              <span className="min-w-0 truncate"><span className="font-medium">{h.actor?.name ?? 'Unknown'}</span> <span className="text-muted-foreground">· {h.action.replace('auth.', '')}</span></span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <Badge tone={statusTone(h.status)}>{h.status}</Badge>
                {h.ip && <span className="font-mono">{h.ip}</span>}
                {dateTime(h.at)}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
