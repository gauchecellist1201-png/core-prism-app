import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';

interface Action {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  onClick: () => void;
  primary?: boolean;
}

interface Props {
  persona: Persona;
  actions: Action[];
}

export default function QuickActions({ persona, actions }: Props) {
  return (
    <motion.div
      className="rounded-2xl p-3"
      style={{
        background: 'var(--surface-3)',
        border: '1px solid var(--border)',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-fg text-base font-medium">⚡ クイックアクション</p>
        <p className="text-fg-muted text-xs">よく使う操作</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {actions.map((a, i) => (
          <motion.button
            key={a.id}
            onClick={a.onClick}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all"
            style={{
              background: a.primary
                ? `linear-gradient(135deg, ${persona.accentColor}25, ${persona.accentColor}10)`
                : 'var(--surface)',
              border: `1px solid ${a.primary ? persona.accentColor + '50' : 'var(--border)'}`,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="text-2xl leading-none">{a.emoji}</span>
            <span className="text-fg text-sm font-medium leading-tight text-center">{a.label}</span>
            <span className="text-fg-muted text-[11px] leading-tight text-center hidden md:block">{a.desc}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
