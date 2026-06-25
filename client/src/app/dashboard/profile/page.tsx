'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Upload, FileText } from 'lucide-react';
import { candidateApi } from '@/lib/candidate.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

export default function ProfilePage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['profile'], queryFn: candidateApi.profile });
  const resumeRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ name: '', phone: '', headline: '', location: '', skills: '', summary: '' });

  useEffect(() => {
    if (data) {
      const p = data.profile || {};
      setForm({
        name: data.user?.name || '',
        phone: data.user?.phone || '',
        headline: p.headline || '',
        location: p.location || '',
        skills: (p.skills || []).join(', '),
        summary: p.summary || '',
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      candidateApi.updateProfile({
        name: form.name,
        phone: form.phone || undefined,
        profile: {
          headline: form.headline,
          location: form.location,
          skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
          summary: form.summary,
        },
      }),
    onSuccess: () => {
      toast.success('Profile saved');
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => toast.error('Save failed'),
  });

  const upload = useMutation({
    mutationFn: (file: File) => candidateApi.uploadResume(file),
    onSuccess: () => {
      toast.success('Resume uploaded');
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => toast.error('Upload failed'),
  });

  const resume = data?.profile?.resume;

  return (
    <div className="space-y-8">
      <PageHeader title="Profile" description="Keep your details up to date for recruiters." />

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <h2 className="text-lg font-semibold">Personal information</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline" value={form.headline} onChange={(v) => setForm((f) => ({ ...f, headline: v }))} placeholder="Senior Frontend Engineer" />
              <Field label="Location" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
            </div>
            <Field label="Skills (comma-separated)" value={form.skills} onChange={(v) => setForm((f) => ({ ...f, skills: v }))} />
            <Textarea label="Summary" value={form.summary} onChange={(v) => setForm((f) => ({ ...f, summary: v }))} />
            <Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>
              <Save className="h-4 w-4" /> Save profile
            </Button>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold">Resume</h2>
          {resume?.filename ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3">
              <FileText className="h-5 w-5 text-primary" />
              <a href={resume.url} target="_blank" rel="noreferrer" className="truncate text-sm hover:underline">
                {resume.filename}
              </a>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No resume uploaded yet.</p>
          )}
          <Button className="mt-4 w-full" variant="glass" magnetic={false} loading={upload.isPending} onClick={() => resumeRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload resume
          </Button>
          <input
            ref={resumeRef}
            type="file"
            accept=".pdf,.docx,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
          <p className="mt-3 text-xs text-muted-foreground">PDF, DOCX, or TXT. Used by recruiters and AI matching.</p>
        </GlassCard>
      </div>
    </div>
  );
}
