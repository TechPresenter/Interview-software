'use client';

import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

/** Animated AI interviewer avatar. Pulses/ripples while `speaking`. Shows a
 *  custom image when `avatarUrl` is provided, otherwise a default bot icon. */
export function AiAvatar({ speaking, avatarUrl }: { speaking: boolean; avatarUrl?: string | null }) {
  return (
    <div className="relative grid h-32 w-32 place-items-center">
      {/* Ripple rings while speaking */}
      {speaking &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border border-primary/40"
            initial={{ width: 80, height: 80, opacity: 0.6 }}
            animate={{ width: 160, height: 160, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
          />
        ))}

      <motion.div
        animate={speaking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.8, repeat: speaking ? Infinity : 0 }}
        className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-gradient-brand shadow-glow"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="AI interviewer" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <Bot className="h-12 w-12 text-white" />
        )}
      </motion.div>
    </div>
  );
}

export default AiAvatar;
