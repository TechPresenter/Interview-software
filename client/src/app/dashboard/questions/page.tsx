'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Field } from '@/components/ui/Field';
import { toast } from '@/components/ui/toast';

const CATEGORIES = ['technical', 'hr', 'aptitude', 'behavioral', 'coding', 'custom'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];

export default function QuestionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: 'technical', difficulty: 'medium', text: '', skills: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['questions', page, category],
    queryFn: () => adminApi.questions({ page, limit: 10, category: category || undefined }),
  });
  const { data: stats } = useQuery({ queryKey: ['question-stats'], queryFn: adminApi.questionStats });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createQuestion({
        category: form.category,
        difficulty: form.difficulty,
        text: form.text,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }),
    onSuccess: () => {
      toast.success('Question added');
      setOpen(false);
      setForm({ category: 'technical', difficulty: 'medium', text: '', skills: '' });
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['question-stats'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteQuestion(id),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const columns: Column<any>[] = [
    { key: 'text', header: 'Question', render: (r) => <span className="line-clamp-2 max-w-xl">{r.text}</span> },
    { key: 'category', header: 'Category', render: (r) => <Badge tone="info">{r.category}</Badge> },
    { key: 'difficulty', header: 'Difficulty', render: (r) => <Badge tone="muted">{r.difficulty}</Badge> },
    { key: 'usageCount', header: 'Used', render: (r) => r.usageCount ?? 0 },
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
      <PageHeader
        title="Question Bank"
        description={`Global library · ${stats?.total ?? 0} questions`}
        action={
          <Button size="sm" magnetic={false} onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add question
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={!category} onClick={() => { setCategory(''); setPage(1); }}>
          All
        </FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => { setCategory(c); setPage(1); }}>
            {titleCase(c)}
          </FilterChip>
        ))}
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
        title="Add question"
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
            <Button magnetic={false} loading={create.isPending} onClick={() => create.mutate()}>Add</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={CATEGORIES.map((c) => ({ label: titleCase(c), value: c }))} />
            <Select label="Difficulty" value={form.difficulty} onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))} options={DIFFICULTIES.map((d) => ({ label: titleCase(d), value: d }))} />
          </div>
          <Textarea label="Question text" value={form.text} onChange={(v) => setForm((f) => ({ ...f, text: v }))} rows={4} />
          <Field label="Skills (comma-separated)" value={form.skills} onChange={(v) => setForm((f) => ({ ...f, skills: v }))} placeholder="react, system-design" />
        </div>
      </Modal>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-1.5 text-sm transition',
        active ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
