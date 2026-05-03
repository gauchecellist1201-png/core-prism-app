import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Lock } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import { evaluateAchievements, totalStreak } from '../../data/achievements';
import type { useHealth } from '../../hooks/useHealth';

interface Props {
  health: ReturnType<typeof useHealth>;
}

const CATEGORY_COLORS = {
  sleep: PRISM.logic,
  recovery: PRISM.empathy,
  activity: PRISM.action,
  mind: PRISM.creative,
  nutrition: PRISM.ethics,
  streak: '#FF6F45',
} as const;

export function Achievements({ health }: Props) {
  const achievements = useMemo(() => evaluateAchievements(health.days), [health.days]);
  const streak = totalStreak(health.days);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'progress'>('all');

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const filtered =
    filter === 'unlocked'
      ? achievements.filter((a) => a.unlocked)
      : filter === 'progress'
      ? achievements.filter((a) => !a.unlocked && a.progress > 0)
      : achievements;

  // unlocked 先頭、それ以降は進捗高い順
  const sorted = [...filtered].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return b.progress - a.progress;
  });

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: PRISM.ethics }} />
          <span className="text-[12px] tracking-[0.4em] text-fg-muted">
            ACHIEVEMENTS · 達成バッジ
          </span>
        </div>
        <div className="flex items-center gap-2">
          {streak >= 2 && (
            <Pill color="#FF6F45">
              <Flame className="mr-1 h-2.5 w-2.5" />
              {streak} 日連続
            </Pill>
          )}
          <Pill color={PRISM.ethics}>
            {unlockedCount}/{achievements.length}
          </Pill>
        </div>
      </div>

      <div className="mt-3 flex gap-1">
        {(['all', 'unlocked', 'progress'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[12px] tracking-wider transition ${
              filter === f
                ? 'bg-surface-3 text-fg'
                : 'bg-surface-2 text-fg-muted hover:bg-white/8'
            }`}
          >
            {f === 'all' ? 'すべて' : f === 'unlocked' ? '達成済' : '進行中'}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
        {sorted.length === 0 && (
          <div className="col-span-full py-4 text-center text-[13px] text-fg-subtle">
            該当バッジがありません
          </div>
        )}
        {sorted.map((a, i) => {
          const color = CATEGORY_COLORS[a.category];
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`relative overflow-hidden rounded-xl p-3 ${
                a.unlocked ? 'bg-white/5' : 'bg-white/2'
              }`}
              style={
                a.unlocked
                  ? { boxShadow: `inset 0 0 0 1px ${color}55, 0 12px 30px -16px ${color}` }
                  : { border: '1px solid rgba(255,255,255,0.05)' }
              }
            >
              {a.unlocked && (
                <div
                  className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-50 blur-2xl"
                  style={{ background: color }}
                />
              )}
              <div className="relative flex items-start gap-2.5">
                <span
                  className={`text-[26px] leading-none ${
                    a.unlocked ? '' : 'grayscale opacity-40'
                  }`}
                >
                  {a.emoji}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[14px] ${
                        a.unlocked ? 'font-medium text-fg' : 'text-fg-muted'
                      }`}
                    >
                      {a.title}
                    </span>
                    {!a.unlocked && <Lock className="h-2.5 w-2.5 text-fg-subtle" />}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                    {a.detail}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${a.progress}%`,
                        background: a.unlocked ? color : 'rgba(255,255,255,0.4)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
