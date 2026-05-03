import { useMemo, useState } from 'react';
import { PRISM, Pill } from '../prism/MockShell';
import { spectrumFromDay } from '../../data/mockHealth';
import type { DailyHealth } from '../../types/health';

interface Props {
  days: DailyHealth[];
}

const METRICS: Array<{
  key: keyof ReturnType<typeof spectrumFromDay>;
  label: string;
  color: string;
}> = [
  { key: 'sleep',     label: 'SLEEP',     color: PRISM.logic },
  { key: 'recovery',  label: 'RECOVERY',  color: PRISM.empathy },
  { key: 'activity',  label: 'ACTIVITY',  color: PRISM.action },
  { key: 'mind',      label: 'MIND',      color: PRISM.creative },
  { key: 'nutrition', label: 'NUTRITION', color: PRISM.ethics },
];

export function HealthHeatmap({ days }: Props) {
  const [metric, setMetric] = useState<typeof METRICS[number]['key']>('sleep');
  const slice = days.slice(-30);

  const cells = useMemo(
    () =>
      slice.map((d) => {
        const sp = spectrumFromDay(d);
        return { date: d.date, value: sp[metric], spectrum: sp };
      }),
    [slice, metric]
  );

  const meta = METRICS.find((m) => m.key === metric)!;
  const avgValue = Math.round(
    cells.reduce((s, c) => s + c.value, 0) / Math.max(1, cells.length)
  );
  const goodDays = cells.filter((c) => c.value >= 70).length;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">
          30 DAY HEATMAP · 健康スコア俯瞰
        </div>
        <Pill color={meta.color}>
          {meta.label} 平均 {avgValue} · 良日 {goodDays}/{cells.length}
        </Pill>
      </div>

      <div className="mt-3 flex gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded-full px-3 py-1 text-[12px] tracking-wider transition ${
              metric === m.key ? 'text-fg' : 'text-fg-subtle'
            }`}
            style={{
              background: metric === m.key ? `${m.color}1F` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${metric === m.key ? `${m.color}55` : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Calendar-like grid (30 days, 6 columns × 5 rows) */}
      <div className="mt-4 grid grid-cols-10 gap-1">
        {cells.map((c) => {
          const intensity = c.value / 100;
          const bg = `${meta.color}${Math.round(intensity * 255)
            .toString(16)
            .padStart(2, '0')}`;
          return (
            <div
              key={c.date}
              className="aspect-square rounded-md"
              style={{
                background: bg,
                boxShadow: `inset 0 0 0 1px rgba(255,255,255,${intensity * 0.18})`,
              }}
              title={`${c.date} · ${meta.label} ${c.value}`}
            >
              <div className="flex h-full items-end justify-end p-1">
                <span className="font-mono text-[8px] text-fg-muted">
                  {c.date.slice(8, 10)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-fg-subtle">
        <span>{cells[0]?.date}</span>
        <div className="flex items-center gap-1">
          <span>低</span>
          {[20, 40, 60, 80, 100].map((v) => (
            <span
              key={v}
              className="h-2 w-3 rounded-sm"
              style={{
                background: `${meta.color}${Math.round((v / 100) * 255)
                  .toString(16)
                  .padStart(2, '0')}`,
              }}
            />
          ))}
          <span>高</span>
        </div>
        <span>{cells[cells.length - 1]?.date}</span>
      </div>

      {/* Mini all-axis combined bar (composite score) */}
      <div className="mt-4 rounded-xl border border-white/8 bg-surface-2 p-3">
        <div className="text-[12px] tracking-[0.3em] text-fg-subtle">
          5 AXIS COMPOSITE · 過去30日
        </div>
        <div className="mt-2 flex items-end gap-[2px]" style={{ height: 64 }}>
          {cells.map((c) => {
            const composite =
              (c.spectrum.sleep +
                c.spectrum.recovery +
                c.spectrum.activity +
                c.spectrum.mind +
                c.spectrum.nutrition) /
              5;
            return (
              <div
                key={c.date}
                className="flex-1 rounded-t-sm"
                style={{
                  height: `${composite}%`,
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(176,124,255,0.6) 100%)',
                }}
                title={`${c.date} · ${composite.toFixed(0)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
