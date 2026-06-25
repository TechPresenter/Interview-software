'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Eyebrow } from './AiDemo';

const faqs = [
  { q: 'How does the AI interview actually work?', a: 'Candidates open a private link, pass a quick camera/mic check, then talk to an adaptive AI interviewer that asks role-relevant questions, follows up, and adjusts difficulty live — generating a scored report the moment it ends.' },
  { q: 'Is it fair and unbiased?', a: 'Every answer is scored against role competencies with transparent reasoning, and the same rubric is applied to all candidates. You control the weighting of each competency.' },
  { q: 'Can candidates cheat?', a: 'Built-in proctoring detects tab switches, window blur, paste, and fullscreen exits, computing a live integrity score that flags suspicious sessions.' },
  { q: 'Which roles does it support?', a: 'Technical, HR, behavioral, aptitude, and coding interviews — fully configurable per job, including question count and duration.' },
  { q: 'Do you offer a free plan?', a: 'Yes. Start free with limited interviews per month, then upgrade to Starter, Professional, or Enterprise as you scale.' },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="container py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>FAQ</Eyebrow>
        <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Questions, answered</h2>
      </div>
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="glass overflow-hidden rounded-2xl">
              <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                <span className="font-medium">{f.q}</span>
                <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted/60 text-primary">
                  <Plus className="h-4 w-4" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default Faq;
