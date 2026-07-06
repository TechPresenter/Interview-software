'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Upload, Save, Volume2 } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { speak, loadVoices, type VoicePref } from '@/lib/voice';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

export default function InterviewerPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ai-interviewer'], queryFn: companyApi.aiInterviewer });
  const [form, setForm] = useState<{ name: string; voice: VoicePref; intro: string }>({ name: '', voice: 'female', intro: '' });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { loadVoices(); }, []);
  useEffect(() => {
    if (data) { setForm({ name: data.name || 'Sense', voice: data.voice || 'female', intro: data.intro || '' }); setAvatarUrl(data.avatarUrl || null); }
  }, [data]);

  const save = useMutation({
    mutationFn: () => companyApi.updateInterviewer(form),
    onSuccess: () => { toast.success('AI interviewer saved'); qc.invalidateQueries({ queryKey: ['ai-interviewer'] }); },
    onError: () => toast.error('Save failed'),
  });
  const upload = useMutation({
    mutationFn: (file: File) => companyApi.uploadInterviewerAvatar(file),
    onSuccess: (d: any) => { setAvatarUrl(d.avatarUrl); toast.success('Avatar uploaded'); qc.invalidateQueries({ queryKey: ['ai-interviewer'] }); },
    onError: () => toast.error('Upload failed'),
  });

  const fullAvatar = avatarUrl ? `${API_ORIGIN}${avatarUrl}` : null;

  function preview() {
    const text = form.intro?.trim() || `Hello, I'm ${form.name || 'your interviewer'}. Let's begin your interview.`;
    speak(text, 'en', { voice: form.voice });
  }

  return (
    <div className="space-y-8">
      <PageHeader title="AI Interviewer" description="Customize the AI interviewer your candidates meet — name, avatar, voice, and introduction." />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <GlassCard className="text-center">
          <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-gradient-brand shadow-glow">
            {fullAvatar ? <img src={fullAvatar} alt="avatar" className="h-28 w-28 rounded-full object-cover" /> : <Bot className="h-14 w-14 text-white" />}
          </div>
          <p className="mt-3 font-semibold">{form.name || 'Sense'}</p>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
          <Button className="mt-3" size="sm" variant="glass" magnetic={false} loading={upload.isPending} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Upload avatar</Button>
        </GlassCard>

        <GlassCard>
          <div className="space-y-4">
            <Field label="Interviewer name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Aarohi" />
            <Select
              label="Voice"
              value={form.voice}
              onChange={(v) => set('voice', v)}
              options={[{ label: 'Female (Indian)', value: 'female' }, { label: 'Male (Indian)', value: 'male' }, { label: 'Auto / system', value: 'auto' }]}
            />
            <Textarea label="Introduction (spoken to candidates)" value={form.intro} onChange={(v) => set('intro', v)} rows={3} placeholder="e.g. Hi! I'm Aarohi from Acme. I'll be conducting your interview today — relax and answer naturally." />
            <div className="flex gap-2">
              <Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" /> Save</Button>
              <Button variant="glass" magnetic={false} onClick={preview}><Volume2 className="h-4 w-4" /> Preview voice</Button>
            </div>
            <p className="text-xs text-muted-foreground">This name, avatar, and voice appear in the candidate's interview room. English &amp; Hindi are supported; actual voice depends on the candidate device's installed voices.</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
