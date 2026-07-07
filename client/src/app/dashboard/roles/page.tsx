'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

type Perms = Record<string, Record<string, boolean>>;

export default function RolesPage() {
  const qc = useQueryClient();
  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: companyApi.roles });
  const { data: catalog } = useQuery({ queryKey: ['roles-catalog'], queryFn: companyApi.rolesCatalog });

  const modules: { key: string; label: string }[] = catalog?.modules ?? [];
  const actions: string[] = catalog?.actions ?? ['create', 'read', 'update', 'delete'];
  const templates: any[] = catalog?.templates ?? [];

  const [editing, setEditing] = useState<any | null>(null); // role object, or {} for new
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [perms, setPerms] = useState<Perms>({});

  const emptyPerms = useMemo<Perms>(
    () => Object.fromEntries(modules.map((m) => [m.key, Object.fromEntries(actions.map((a) => [a, false]))])),
    [modules, actions],
  );

  const openEditor = (role: any | null) => {
    setEditing(role ?? {});
    setName(role?.name ?? '');
    setDesc(role?.description ?? '');
    setPerms({ ...emptyPerms, ...(role?.permissions ?? {}) });
  };

  const toggle = (mod: string, action: string) =>
    setPerms((p) => ({ ...p, [mod]: { ...p[mod], [action]: !p[mod]?.[action] } }));

  const applyTemplate = (key: string) => {
    const t = templates.find((x) => x.key === key);
    if (t) setPerms({ ...emptyPerms, ...t.permissions });
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ['roles'] });

  const save = useMutation({
    mutationFn: () => {
      const body = { name, description: desc, permissions: perms };
      return editing?._id ? companyApi.updateRole(editing._id, body) : companyApi.createRole(body);
    },
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Role saved'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => companyApi.deleteRole(id),
    onSuccess: () => { invalidate(); toast.success('Role deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        description="Define custom staff roles with granular module access."
        action={<Button size="sm" magnetic={false} onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> New role</Button>}
      />

      {editing && (
        <GlassCard>
          <h2 className="text-lg font-semibold">{editing._id ? 'Edit role' : 'New role'}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Role name" value={name} onChange={setName} placeholder="e.g. Senior Recruiter" />
            <Field label="Description" value={desc} onChange={setDesc} placeholder="What this role can do" />
            {!editing._id && (
              <Select label="Start from template" value="" onChange={applyTemplate} options={[{ label: 'Blank', value: '' }, ...templates.map((t) => ({ label: t.name, value: t.key }))]} />
            )}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3">Module</th>
                  {actions.map((a) => <th key={a} className="pb-3 text-center capitalize">{a}</th>)}
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.key} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 font-medium">{m.label}</td>
                    {actions.map((a) => (
                      <td key={a} className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!perms[m.key]?.[a]}
                          onChange={() => toggle(m.key, a)}
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                          aria-label={`${m.label} ${a}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex gap-2">
            <Button size="sm" magnetic={false} loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>Save role</Button>
            <Button size="sm" variant="ghost" magnetic={false} onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (roles ?? []).length === 0 && (
          <GlassCard className="md:col-span-2 xl:col-span-3">
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <p className="font-medium">No custom roles yet</p>
              <p className="text-sm text-muted-foreground">Create a role to grant teammates precise, module-level access.</p>
              <Button size="sm" magnetic={false} onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> New role</Button>
            </div>
          </GlassCard>
        )}
        {(roles ?? []).map((r: any) => {
          const granted = Object.values(r.permissions ?? {}).filter((m: any) => m && Object.values(m).some(Boolean)).length;
          return (
            <GlassCard key={r._id} className="flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.description && <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>}
                </div>
                <Badge tone="info">{r.members ?? 0} staff</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{granted} module{granted === 1 ? '' : 's'} with access</p>
              <div className="mt-auto flex gap-2 pt-4">
                <Button size="sm" variant="glass" magnetic={false} onClick={() => openEditor(r)}><Pencil className="h-4 w-4" /> Edit</Button>
                <Button size="sm" variant="ghost" magnetic={false} onClick={() => { if (window.confirm(`Delete role "${r.name}"?`)) del.mutate(r._id); }}><Trash2 className="h-4 w-4" /> Delete</Button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
