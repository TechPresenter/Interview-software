'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, Sparkles } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toast';

type Candidate = { _id: string; name: string; email: string; resumeAnalysis?: { jobMatch?: number } };
type Board = { stage: string; candidates: Candidate[] };

const STAGE_TONE: Record<string, { bar: string; dot: string }> = {
  applied: { bar: 'from-sky-500/70', dot: 'bg-sky-500' },
  screening: { bar: 'from-yellow-500/70', dot: 'bg-yellow-500' },
  interview: { bar: 'from-primary/70', dot: 'bg-primary' },
  shortlisted: { bar: 'from-accent/70', dot: 'bg-accent' },
  hired: { bar: 'from-green-500/70', dot: 'bg-green-500' },
  rejected: { bar: 'from-destructive/70', dot: 'bg-destructive' },
};

export default function PipelinePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['pipeline'], queryFn: () => companyApi.pipeline() });

  // Local, optimistic copy of the board so drag feels instant.
  const [columns, setColumns] = useState<Board[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (data?.columns) setColumns(data.columns);
  }, [data]);

  const stages = useMemo(() => columns.map((c) => c.stage), [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => companyApi.moveStage(id, stage),
    onSuccess: (_d, v) => {
      toast.success(`Moved to ${titleCase(v.stage)}`);
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      qc.invalidateQueries({ queryKey: ['company-overview'] });
    },
    onError: () => {
      toast.error('Move failed — reverting');
      if (data?.columns) setColumns(data.columns);
    },
  });

  const activeCandidate = useMemo(() => {
    for (const col of columns) {
      const hit = col.candidates.find((c) => c._id === activeId);
      if (hit) return hit;
    }
    return null;
  }, [activeId, columns]);

  const findStage = (id: string) => columns.find((c) => c.candidates.some((x) => x._id === id))?.stage;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const from = findStage(id);
    // `over` is either a column (droppable) or a card; resolve to its column.
    const to = stages.includes(String(over.id)) ? String(over.id) : findStage(String(over.id));
    if (!from || !to || from === to) return;

    // Optimistic local move.
    setColumns((prev) => {
      const card = prev.find((c) => c.stage === from)?.candidates.find((x) => x._id === id);
      if (!card) return prev;
      return prev.map((col) => {
        if (col.stage === from) return { ...col, candidates: col.candidates.filter((x) => x._id !== id) };
        if (col.stage === to) return { ...col, candidates: [card, ...col.candidates] };
        return col;
      });
    });
    move.mutate({ id, stage: to });
  };

  const total = columns.reduce((n, c) => n + c.candidates.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Drag candidates through your hiring stages — changes save instantly."
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No candidates yet. Add candidates to start building your pipeline.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {columns.map((col) => (
              <Column key={col.stage} col={col} stages={stages} onSelectMove={(id, stage) => {
                setColumns((prev) => {
                  const card = prev.find((c) => c.stage === col.stage)?.candidates.find((x) => x._id === id);
                  if (!card) return prev;
                  return prev.map((c) => {
                    if (c.stage === col.stage) return { ...c, candidates: c.candidates.filter((x) => x._id !== id) };
                    if (c.stage === stage) return { ...c, candidates: [card, ...c.candidates] };
                    return c;
                  });
                });
                move.mutate({ id, stage });
              }} />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
            {activeCandidate ? <CardBody c={activeCandidate} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function Column({
  col,
  stages,
  onSelectMove,
}: {
  col: Board;
  stages: string[];
  onSelectMove: (id: string, stage: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.stage });
  const tone = STAGE_TONE[col.stage] || { bar: 'from-border', dot: 'bg-border' };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-2xl border bg-card/40 transition-colors',
        isOver ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/30' : 'border-border',
      )}
    >
      <div className={cn('rounded-t-2xl bg-gradient-to-r to-transparent px-3.5 py-3', tone.bar)}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold capitalize">
            <span className={cn('h-2 w-2 rounded-full', tone.dot)} /> {col.stage}
          </span>
          <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {col.candidates.length}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 p-2.5">
        {col.candidates.map((c) => (
          <DraggableCard key={c._id} c={c} stage={col.stage} stages={stages} onSelectMove={onSelectMove} />
        ))}
        {col.candidates.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  c,
  stage,
  stages,
  onSelectMove,
}: {
  c: Candidate;
  stage: string;
  stages: string[];
  onSelectMove: (id: string, stage: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c._id });

  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-40')}>
      <div className="group rounded-xl border border-border bg-card/80 p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md">
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            className="mt-0.5 -ml-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to move"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{c.name}</p>
            <p className="truncate text-xs text-muted-foreground">{c.email}</p>
            {c.resumeAnalysis?.jobMatch != null && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                {c.resumeAnalysis.jobMatch}% match
              </p>
            )}
          </div>
        </div>
        {/* Accessible / touch-friendly fallback for moving between stages */}
        <select
          value={stage}
          onChange={(e) => e.target.value !== stage && onSelectMove(c._id, e.target.value)}
          aria-label={`Move ${c.name} to another stage`}
          className="mt-2 w-full rounded-lg border border-border bg-background/60 px-2 py-1 text-xs text-muted-foreground outline-none transition focus:border-primary focus:text-foreground focus:ring-2 focus:ring-primary/30"
        >
          {stages.map((s) => (
            <option key={s} value={s} className="bg-card text-foreground">
              {titleCase(s)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CardBody({ c, dragging }: { c: Candidate; dragging?: boolean }) {
  return (
    <div className={cn('w-[240px] rounded-xl border border-primary/50 bg-card p-3 shadow-xl', dragging && 'rotate-2')}>
      <p className="truncate text-sm font-medium">{c.name}</p>
      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
      {c.resumeAnalysis?.jobMatch != null && (
        <p className="mt-1 text-[11px] font-medium text-accent">{c.resumeAnalysis.jobMatch}% match</p>
      )}
    </div>
  );
}
