'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
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

type FieldDef = { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'select'; options?: string[] };

interface ResourceConfig {
  resource: string;
  label: string;
  columns: Column<any>[];
  fields: FieldDef[];
}

const CONFIGS: ResourceConfig[] = [
  {
    resource: 'blog',
    label: 'Blog',
    columns: [
      { key: 'title', header: 'Title' },
      { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'published' ? 'success' : 'muted'}>{r.status}</Badge> },
      { key: 'views', header: 'Views' },
      { key: 'createdAt', header: 'Created', render: (r) => date(r.createdAt) },
    ],
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
      { key: 'content', label: 'Content (markdown)', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published'] },
    ],
  },
  {
    resource: 'faqs',
    label: 'FAQs',
    columns: [
      { key: 'question', header: 'Question' },
      { key: 'category', header: 'Category' },
      { key: 'order', header: 'Order' },
    ],
    fields: [
      { key: 'question', label: 'Question' },
      { key: 'answer', label: 'Answer', type: 'textarea' },
      { key: 'category', label: 'Category' },
      { key: 'order', label: 'Order', type: 'number' },
    ],
  },
  {
    resource: 'testimonials',
    label: 'Testimonials',
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'company', header: 'Company' },
      { key: 'rating', header: 'Rating' },
    ],
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'company', label: 'Company' },
      { key: 'quote', label: 'Quote', type: 'textarea' },
      { key: 'rating', label: 'Rating (1-5)', type: 'number' },
    ],
  },
  {
    resource: 'announcements',
    label: 'Announcements',
    columns: [
      { key: 'title', header: 'Title' },
      { key: 'type', header: 'Type', render: (r) => <Badge tone="info">{r.type}</Badge> },
      { key: 'isActive', header: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
    ],
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'type', label: 'Type', type: 'select', options: ['info', 'success', 'warning', 'critical'] },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all', 'companies', 'candidates'] },
    ],
  },
  {
    resource: 'templates',
    label: 'Templates',
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
    ],
  },
];

export default function CmsPage() {
  const [tab, setTab] = useState(0);
  const config = CONFIGS[tab];

  return (
    <div>
      <PageHeader title="CMS" description="Marketing content, FAQs, announcements, and templates." />
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

function ResourceManager({ config }: { config: ResourceConfig }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['cms', config.resource, page],
    queryFn: () => adminApi.cmsList(config.resource, { page, limit: 10 }),
  });

  const create = useMutation({
    mutationFn: () => adminApi.cmsCreate(config.resource, coerce(form, config.fields)),
    onSuccess: () => {
      toast.success(`${config.label} item created`);
      setOpen(false);
      setForm({});
      qc.invalidateQueries({ queryKey: ['cms', config.resource] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.cmsDelete(config.resource, id),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['cms', config.resource] });
    },
  });

  const columns: Column<any>[] = [
    ...config.columns,
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
          <Plus className="h-4 w-4" /> New {config.label.replace(/s$/, '')}
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
        title={`New ${config.label.replace(/s$/, '')}`}
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
            <Button magnetic={false} loading={create.isPending} onClick={() => create.mutate()}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          {config.fields.map((f) => {
            const value = form[f.key] ?? '';
            const set = (v: any) => setForm((p) => ({ ...p, [f.key]: v }));
            if (f.type === 'textarea') return <Textarea key={f.key} label={f.label} value={value} onChange={set} />;
            if (f.type === 'select')
              return <Select key={f.key} label={f.label} value={value || f.options![0]} onChange={set} options={(f.options || []).map((o) => ({ label: o, value: o }))} />;
            return <Field key={f.key} label={f.label} type={f.type === 'number' ? 'number' : 'text'} value={String(value)} onChange={set} />;
          })}
        </div>
      </Modal>
    </div>
  );
}

/** Coerce number fields before submit. */
function coerce(form: Record<string, any>, fields: FieldDef[]) {
  const out = { ...form };
  for (const f of fields) if (f.type === 'number' && out[f.key] != null && out[f.key] !== '') out[f.key] = Number(out[f.key]);
  return out;
}
