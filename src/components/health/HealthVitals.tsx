import { useMemo, useState } from 'react';
import { PRISM, Pill } from '../prism/MockShell';
import { CircadianClock } from './CircadianClock';
import type { useHealth } from '../../hooks/useHealth';

interface Props {
  health: ReturnType<typeof useHealth>;
}

type Range = '7d' | '30d';

const METRICS = [
  { key: 'sleepHours' as const,    label: 'SLEEP',    unit: 'h',   color: PRISM.logic,    target: 7.5,   targetCmp: 'gte' as const },
  { key: 'hrv' as const,           label: 'HRV',      unit: 'ms',  color: PRISM.empathy,  target: 55,    targetCmp: 'gte' as const },
  { key: 'steps' as const,         label: 'STEPS',    unit: '',    color: PRISM.action,   target: 8000,  targetCmp: 'gte' as const },
  { key: 'stressLevel' as const,   label: 'STRESS',   unit: '',    color: PRISM.creative, target: 50,    targetCmp: 'lte' as const },
  { key: 'restingHR' as const,     label: 'RESTING HR', unit: 'bpm', color: PRISM.ethics, target: 65,    targetCmp: 'lte' as const },
];

export function HealthVitals({ health }: Props) {
  const [range, setRange] = useState<Range>('7d');
  const slice = range === '7d' ? health.days.slice(-7) : health.days;
  const week = health.days.slice(-7);
  const weekAvgSleep =
    week.length > 0 ? week.reduce((s, d) => s + d.sleepHours, 0) / week.length : 7;

  return (
    <div className="flex flex-col gap-4">
      {health.today && (
        <CircadianClock today={health.today} weekAvgSleep={weekAvgSleep} />
      )}

      <div className="flex items-center justify-between">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">VITALS TREND</div>
        <div className="flex gap-1 rounded-full border border-white/10 bg-surface-2 p-0.5">
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 text-[12px] tracking-wider transition ${
                range === r ? 'bg-surface-3 text-fg' : 'text-fg-subtle'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {METRICS.map((m) => (
          <MetricRow
            key={m.key}
            label={m.label}
            color={m.color}
            unit={m.unit}
            values={slice.map((d) => Number(d[m.key] ?? 0))}
            dates={slice.map((d) => d.date)}
            target={m.target}
            targetCmp={m.targetCmp}
          />
        ))}
      </div>
    </div>
  );
}

function MetricRow({
  label, color, unit, values, dates, target, targetCmp,
}: {
  label: string;
  color: string;
  unit: string;
  values: number[];
  dates: string[];
  target: number;
  targetCmp: 'gte' | 'lte';
}) {
  const max = Math.max(...values, target);
  const min = Math.min(...values, 0);
  const avg = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
  const last = values[values.length - 1] ?? 0;
  const trend = last - avg;
  const onTarget = useMemo(() => {
    return values.filter((v) => (targetCmp === 'gte' ? v >= target : v <= target)).length;
  }, [values, target, targetCmp]);

  const W = 760;
  const H = 90;
  const xStep = W / Math.max(1, values.length - 1);
  const norm = (v: number) =>
    H - ((v - min) / Math.max(1, max - min)) * (H - 12) - 6;
  const points = values.map((v, i) => `${i * xStep},${norm(v)}`).join(' ');
  const fill = `${points} ${W},${H} 0,${H}`;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-[12px] tracking-[0.3em]" style={{ color }}>{label}</span>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-fg-muted">
          <span>last <span className="font-mono text-fg">{format(last)}</span>{unit}</span>
          <span>avg <span className="font-mono">{format(avg)}</span>{unit}</span>
          <span>
            trend
            <span className={`ml-1 font-mono ${trend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {trend >= 0 ? '+' : ''}{format(trend)}
            </span>
          </span>
          <Pill color={color}>{onTarget}/{values.length} 目標</Pill>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[90px] w-full">
        <defs>
          <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* target line */}
        <line
          x1="0"
          y1={norm(target)}
          x2={W}
          y2={norm(target)}
          stroke={color}
          strokeOpacity="0.25"
          strokeDasharray="3 3"
        />
        <polygon points={fill} fill={`url(#g-${label})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" />
        {/* end dot */}
        {values.length > 0 && (
          <circle
            cx={(values.length - 1) * xStep}
            cy={norm(last)}
            r="3.5"
            fill={color}
            stroke="#0A0A0A"
            strokeWidth="2"
          />
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-fg-subtle">
        <span>{dates[0]}</span>
        <span>{dates[Math.floor(dates.length / 2)]}</span>
        <span>{dates[dates.length - 1]}</span>
      </div>
    </div>
  );
}

function format(v: number) {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(1);
}
