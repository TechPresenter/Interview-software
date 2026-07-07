'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Search, Eye, EyeOff, ImagePlus, X, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { date } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

// CKEditor is browser-only — load it without SSR.
const RichTextEditor = dynamic(() => import('@/components/ui/RichTextEditor').then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => <div className="skeleton h-72 rounded-xl" />,
});

type FieldType = 'text' | 'textarea' | 'richtext' | 'number' | 'select' | 'image' | 'tags' | 'boolean';
type FieldDef = { key: string; label: string; type?: FieldType; options?: string[]; help?: string };

interface ResourceConfig {
  resource: string;
  label: string;
  singular: string;
  columns: Column<any>[];
  fields: FieldDef[];
  /** Field used for the quick publish/active toggle in the row actions. */
  toggle?: { key: string; on: any; off: any; onLabel: string; offLabel: string };
  wide?: boolean;
}

const CONFIGS: ResourceConfig[] = [
  {
    resource: 'blog',
    label: 'Blog',
    singular: 'Post',
    wide: true,
    toggle: { key: 'status', on: 'published', off: 'draft', onLabel: 'Published', offLabel: 'Draft' },
    columns: [
      { key: 'title', header: 'Title' },
      { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'published' ? 'success' : 'muted'}>{r.status}</Badge> },
      { key: 'views', header: 'Views', render: (r) => <span className="tabular-nums">{r.views ?? 0}</span> },
      { key: 'createdAt', header: 'Created', render: (r) => date(r.createdAt) },
    ],
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'coverImage', label: 'Cover image', type: 'image' },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea', help: 'Short summary shown in listings + meta description fallback.' },
      { key: 'content', label: 'Content', type: 'richtext' },
      { key: 'tags', label: 'Tags', type: 'tags', help: 'Comma-separated.' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published'] },
      { key: 'seo.title', label: 'SEO title', help: 'Optional — overrides the browser/tab + search title.' },
      { key: 'seo.description', label: 'SEO description', type: 'textarea' },
    ],
  },
  {
    resource: 'faqs',
    label: 'FAQs',
    singular: 'FAQ',
    toggle: { key: 'isActive', on: true, off: false, onLabel: 'Active', offLabel: 'Hidden' },
    columns: [
      { key: 'question', header: 'Question' },
      { key: 'category', header: 'Category', render: (r) => r.category || '—' },
      { key: 'isActive', header: 'Active', render: (r) => <Badge tone={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'Yes' : 'No'}</Badge> },
      { key: 'order', header: 'Order', render: (r) => <span className="tabular-nums">{r.order ?? 0}</span> },
    ],
    fields: [
      { key: 'question', label: 'Question' },
      { key: 'answer', label: 'Answer', type: 'textarea' },
      { key: 'category', label: 'Category' },
      { key: 'order', label: 'Order', type: 'number' },
      { key: 'isActive', label: 'Active (visible on site)', type: 'boolean' },
    ],
  },
  {
    resource: 'testimonials',
    label: 'Testimonials',
    singular: 'Testimonial',
    toggle: { key: 'isActive', on: true, off: false, onLabel: 'Active', offLabel: 'Hidden' },
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'company', header: 'Company', render: (r) => r.company || '—' },
      { key: 'rating', header: 'Rating', render: (r) => '★'.repeat(r.rating || 0) },
      { key: 'isActive', header: 'Active', render: (r) => <Badge tone={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'Yes' : 'No'}</Badge> },
    ],
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'avatar', label: 'Avatar', type: 'image' },
      { key: 'role', label: 'Role' },
      { key: 'company', label: 'Company' },
      { key: 'quote', label: 'Quote', type: 'textarea' },
      { key: 'rating', label: 'Rating (1-5)', type: 'number' },
      { key: 'order', label: 'Order', type: 'number' },
      { key: 'isActive', label: 'Active (visible on site)', type: 'boolean' },
    ],
  },
  {
    resource: 'announcements',
    label: 'Announcements',
    singular: 'Announcement',
    toggle: { key: 'isActive', on: true, off: false, onLabel: 'Active', offLabel: 'Inactive' },
    columns: [
      { key: 'title', header: 'Title' },
      { key: 'type', header: 'Type', render: (r) => <Badge tone="info">{r.type}</Badge> },
      { key: 'isActive', header: 'Active', render: (r) => <Badge tone={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'Yes' : 'No'}</Badge> },
    ],
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'type', label: 'Type', type: 'select', options: ['info', 'success', 'warning', 'critical'] },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all', 'companies', 'candidates'] },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ],
  },
  {
    resource: 'templates',
    label: 'Templates',
    singular: 'Template',
    toggle: { key: 'isActive', on: true, off: false, onLabel: 'Active', offLabel: 'Inactive' },
    columns: [
      { key: 'key', header: 'Key' },
      { key: 'name', header: 'Name' },
      { key: 'channel', header: 'Channel', render: (r) => <Badge tone="muted">{r.channel}</Badge> },
    ],
    fields: [
      { key: 'key', label: 'Key (e.g. interview_invite)' },
      { key: 'name', label: 'Name' },
      { key: 'channel', label: 'Channel', type: 'select', options: ['email', 'sms', 'whatsapp', 'in_app'] },
      { key: 'subject', label: 'Subject (email)' },
      { key: 'body', label: 'Body — use {{variables}}', type: 'textarea' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ],
  },
];

export default function CmsPage() {
  const [tab, setTab] = useState(0);
  const config = CONFIGS[tab];

  return (
    <div>
      <PageHeader title="CMS" description="Marketing content, FAQs, testimonials, announcements, and templates." />
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border p-1">
        {CONFIGS.map((c, i) => (
          <button
            key={c.resource}
            onClick={() => setTab(i)}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium transition', tab === i ? 'bg-gradient-brand text-white shadow-glow' : 'text-muted-foreground hover:text-foreground')}
          >
            {c.label}
          </button>
        ))}
      </div>
      <ResourceManager key={config.resource} config={config} />
    </div>
  );
}

/** Read/write nested keys like "seo.title". */
const getPath = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const setPath = (obj: any, path: string, val: any) => {
  const keys = path.split('.');
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] || {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = val;
  return out;
};

function ResourceManager({ config }: { config: ResourceConfig }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(rawSearch); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ['cms', config.resource, page, search],
    queryFn: () => adminApi.cmsList(config.resource, { page, limit: 10, q: search || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cms', config.resource] });

  const save = useMutation({
    mutationFn: () => {
      const payload = coerce(form, config.fields);
      return editing ? adminApi.cmsUpdate(config.resource, editing._id, payload) : adminApi.cmsCreate(config.resource, payload);
    },
    onSuccess: () => {
      toast.success(editing ? `${config.singular} updated` : `${config.singular} created`);
      setOpen(false);
      setEditing(null);
      setForm({});
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.cmsDelete(config.resource, id),
    onSuccess: () => { toast.success(`${config.singular} deleted`); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, value }: { id: string; value: any }) => adminApi.cmsUpdate(config.resource, id, { [config.toggle!.key]: value }),
    onSuccess: () => { toast.success('Updated'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const openCreate = () => { setEditing(null); setForm(defaults(config.fields)); setOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setForm(fromRow(row, config.fields)); setOpen(true); };

  const columns: Column<any>[] = [
    ...config.columns,
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {config.toggle && (() => {
            const t = config.toggle!;
            const isOn = getPath(r, t.key) === t.on;
            return (
              <button
                onClick={() => toggle.mutate({ id: r._id, value: isOn ? t.off : t.on })}
                title={isOn ? `Set to ${t.offLabel}` : `Set to ${t.onLabel}`}
                className={cn('rounded-lg p-1.5 transition hover:bg-muted/40', isOn ? 'text-green-500' : 'text-muted-foreground')}
              >
                {isOn ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            );
          })()}
          <button onClick={() => openEdit(r)} title="Edit" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => { if (confirm(`Delete this ${config.singular.toLowerCase()}?`)) del.mutate(r._id); }}
            title="Delete"
            className="rounded-lg p-1.5 text-destructive transition hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder={`Search ${config.label.toLowerCase()}…`}
            className="h-10 w-full rounded-xl border border-input bg-card/60 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <Button size="sm" magnetic={false} onClick={openCreate}>
          <Plus className="h-4 w-4" /> New {config.singular}
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        emptyText={search ? 'No matches found' : `No ${config.label.toLowerCase()} yet`}
        rowKey={(r) => r._id}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
      />

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        size={config.wide ? '3xl' : 'lg'}
        title={editing ? `Edit ${config.singular}` : `New ${config.singular}`}
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            <Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>{editing ? 'Save changes' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {config.fields.map((f) => (
            <FormField key={f.key} field={f} value={getPath(form, f.key)} onChange={(v) => setForm((p) => setPath(p, f.key, v))} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

function FormField({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  const help = field.help ? <p className="mt-1 text-xs text-muted-foreground">{field.help}</p> : null;

  if (field.type === 'richtext')
    return (
      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{field.label}</span>
        <RichTextEditor value={value || ''} onChange={onChange} placeholder="Write your post…" />
        {help}
      </div>
    );

  if (field.type === 'textarea') return <div><Textarea label={field.label} value={value ?? ''} onChange={onChange} />{help}</div>;

  if (field.type === 'select')
    return <div><Select label={field.label} value={value || field.options![0]} onChange={onChange} options={(field.options || []).map((o) => ({ label: o, value: o }))} />{help}</div>;

  if (field.type === 'boolean')
    return (
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3">
        <span className="text-sm font-medium">{field.label}</span>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
      </label>
    );

  if (field.type === 'image') return <div><ImageUploadField label={field.label} value={value || ''} onChange={onChange} />{help}</div>;

  if (field.type === 'tags')
    return <div><Field label={field.label} value={Array.isArray(value) ? value.join(', ') : (value ?? '')} onChange={onChange} />{help}</div>;

  return <div><Field label={field.label} type={field.type === 'number' ? 'number' : 'text'} value={value == null ? '' : String(value)} onChange={onChange} />{help}</div>;
}

function ImageUploadField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await adminApi.cmsUploadImage(file);
      onChange(url);
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <Button type="button" size="sm" variant="glass" magnetic={false} disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sensible default form values for a create. */
function defaults(fields: FieldDef[]) {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.type === 'boolean') out[f.key] = true;
    else if (f.type === 'select') out[f.key] = f.options?.[0];
  }
  return out;
}

/** Populate the form from an existing row (handles nested + tags). */
function fromRow(row: any, fields: FieldDef[]) {
  const out: Record<string, any> = {};
  for (const f of fields) {
    const v = getPath(row, f.key);
    out[f.key] = f.type === 'tags' && Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}

/** Coerce + clean the form before submit. */
function coerce(form: Record<string, any>, fields: FieldDef[]) {
  let out: Record<string, any> = {};
  for (const f of fields) {
    let v = getPath(form, f.key);
    if (f.type === 'number') v = v === '' || v == null ? undefined : Number(v);
    else if (f.type === 'tags') v = typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v;
    else if (f.type === 'image') v = v || undefined; // drop empty so URL validation passes
    if (v === undefined) continue;
    out = setPath(out, f.key, v);
  }
  return out;
}
