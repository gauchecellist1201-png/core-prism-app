import { motion } from 'framer-motion';
import { Target, Flame, CheckCircle2, Circle } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import {
  goalsForPersona,
  isHit,
  hitRate,
  streakOf,
  type PersonaGoal,
} from '../../data/personaGoals';
import type { useHealth } from '../../hooks/useHealth';
import type { Persona } from '../../types/identity';

interface Props {
  health: ReturnType<typeof useHealth>;
  persona: Persona;
}

export function PersonaGoals({ health, persona }: Props) {
  const goals = goalsForPersona(persona);
  const today = health.today;
  if (!today) return null;

  const hitsToday = goals.filter((g) =>
    isHit(Number(today[g.metric] ?? 0), g)
  ).length;

  return (
    <div
      className="glass relative overflow-hidden rounded-2xl p-4"
      style={{
        background: `linear-gradient(135deg, ${persona.accentColorLight} 0%, rgba(255,255,255,0.03) 100%)`,
        boxShadow: `0 30px 80px -50px ${persona.accentColor}55`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full opacity-30 blur-3xl"
        style={{ background: persona.accentColor }}
      />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{
              background: `${persona.accentColor}1A`,
              border: `1px solid ${persona.accentColor}55`,
            }}
          >
            <Target
              className="h-3.5 w-3.5"
              strokeWidth={1.5}
              style={{ color: persona.accentColor }}
            />
          </span>
          <div>
            <div className="text-[12px] tracking-[0.4em] text-fg-muted">
              GOALS · {persona.name.toUpperCase()} モード
            </div>
            <div className="text-[13px] text-fg-subtle">
              {persona.subtitle}向けの健康基準
            </div>
          </div>
        </div>
        <Pill color={persona.accentColor}>
          今日 {hitsToday}/{goals.length} 達成
        </Pill>
      </div>

      <div className="relative mt-4 grid grid-cols-1 gap-2">
        {goals.map((goal, i) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            value={Number(today[goal.metric] ?? 0)}
            rate7d={hitRate(health.days, goal, 7)}
            streak={streakOf(health.days, goal)}
            color={persona.accentColor}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  value,
  rate7d,
  streak,
  color: _color,
  index,
}: {
  goal: PersonaGoal;
  value: number;
  rate7d: number;
  streak: number;
  color: string;
  index: number;
}) {
  const hit = isHit(value, goal);
  const targetText = `${goal.comparator === 'gte' ? '≥' : '≤'} ${goal.target}${goal.unit}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4 }}
      className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-3 rounded-xl bg-surface-2 px-3 py-2"
    >
      {hit ? (
        <CheckCircle2 className="h-4 w-4" style={{ color: PRISM.ethics }} />
      ) : (
        <Circle className="h-4 w-4 text-fg-subtle" />
      )}

      <div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-fg">{goal.label}</span>
          <span className="text-[12px] text-fg-subtle">{targetText}</span>
        </div>
        <div className="mt-0.5 text-[14px] text-fg-subtle">{goal.rationale}</div>
      </div>

      <div className="text-right">
        <div
          className="font-mono text-[13px]"
          style={{ color: hit ? PRISM.ethics : '#fff' }}
        >
          {formatVal(value, goal)}
        </div>
        <div className="text-[11px] text-fg-subtle">{goal.unit || '今日'}</div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1">
          <span
            className="font-mono text-[12px] text-fg-muted"
            title={`過去7日 ${rate7d}%`}
          >
            {rate7d}%
          </span>
          <span className="text-[11px] text-fg-subtle">/7d</span>
        </div>
        {streak >= 2 && (
          <div className="flex items-center gap-0.5 text-[13px]" style={{ color: '#FF9F45' }}>
            <Flame className="h-2.5 w-2.5" />
            {streak}d
          </div>
        )}
      </div>
    </motion.div>
  );
}

function formatVal(v: number, g: PersonaGoal): string {
  if (g.metric === 'sleepHours' || g.metric === 'hydrationL') return v.toFixed(1);
  if (g.metric === 'steps' || g.metric === 'caffeineMg') return v.toLocaleString();
  return Math.round(v).toString();
}
