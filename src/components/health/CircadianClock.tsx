import { motion } from 'framer-motion';
import { PRISM, Pill } from '../prism/MockShell';
import type { DailyHealth } from '../../types/health';

interface Props {
  today: DailyHealth;
  weekAvgSleep: number; // 7日平均睡眠時間
}

const SIZE = 360;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = SIZE / 2 - 20;
const R_INNER = R_OUTER - 30;

// ラジアン: 0 = 12時 (top), 時計回り
function angleFor(hour: number) {
  return ((hour - 6) / 24) * Math.PI * 2 - Math.PI / 2;
}

function arcPath(startHour: number, endHour: number, radius: number) {
  const a1 = angleFor(startHour);
  const a2 = angleFor(endHour);
  const x1 = CX + Math.cos(a1) * radius;
  const y1 = CY + Math.sin(a1) * radius;
  const x2 = CX + Math.cos(a2) * radius;
  const y2 = CY + Math.sin(a2) * radius;
  const large = endHour - startHour > 12 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

export function CircadianClock({ today: _today, weekAvgSleep }: Props) {
  const now = new Date();
  const hourNow = now.getHours() + now.getMinutes() / 60;

  // 推奨時間帯 (簡易プリセット)
  const ZONES = [
    { name: '深い睡眠', start: 23, end: 30, color: PRISM.creative, opacity: 0.55 }, // 23:00 - 06:00 (mod 24)
    { name: '朝の光浴', start: 6.5, end: 8.5, color: PRISM.action, opacity: 0.5 },
    { name: '集中ピーク', start: 9, end: 12, color: PRISM.logic, opacity: 0.5 },
    { name: 'ランチ', start: 12, end: 13.5, color: PRISM.ethics, opacity: 0.4 },
    { name: '第2集中', start: 14, end: 17, color: PRISM.logic, opacity: 0.4 },
    { name: '運動推奨', start: 17, end: 19, color: PRISM.action, opacity: 0.45 },
    { name: 'ゴールデン', start: 19, end: 21, color: PRISM.empathy, opacity: 0.5 },
    { name: '入眠準備', start: 21, end: 23, color: PRISM.creative, opacity: 0.5 },
  ];

  // 推奨入眠 / 起床時刻 (週平均睡眠 + 7h目標)
  const recommendedSleep = 22.5;
  const recommendedWake = recommendedSleep + Math.max(7, weekAvgSleep);
  const sleepDuration = recommendedWake - recommendedSleep;

  // 24時間目盛
  const ticks = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">CIRCADIAN CLOCK · ホメオスタシス時計</div>
        <Pill color={PRISM.creative}>24h リズム</Pill>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_220px] gap-4">
        {/* Clock */}
        <div className="flex items-center justify-center">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-[320px] w-[320px]">
            {/* Outer dial circle */}
            <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

            {/* Zones (time-of-day arcs) */}
            {ZONES.map((z, i) => {
              const a1 = angleFor(z.start);
              const a2 = angleFor(z.end);
              const r1 = R_INNER;
              const r2 = R_OUTER;
              const x1o = CX + Math.cos(a1) * r2;
              const y1o = CY + Math.sin(a1) * r2;
              const x2o = CX + Math.cos(a2) * r2;
              const y2o = CY + Math.sin(a2) * r2;
              const x1i = CX + Math.cos(a1) * r1;
              const y1i = CY + Math.sin(a1) * r1;
              const x2i = CX + Math.cos(a2) * r1;
              const y2i = CY + Math.sin(a2) * r1;
              const large = z.end - z.start > 12 ? 1 : 0;
              const d = `M ${x1o} ${y1o} A ${r2} ${r2} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${r1} ${r1} 0 ${large} 0 ${x1i} ${y1i} Z`;
              return (
                <motion.path
                  key={z.name}
                  d={d}
                  fill={z.color}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: z.opacity }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.6 }}
                />
              );
            })}

            {/* Hour ticks */}
            {ticks.map((h) => {
              const a = angleFor(h);
              const r1 = R_OUTER + 4;
              const r2 = R_OUTER + 12;
              const x1 = CX + Math.cos(a) * r1;
              const y1 = CY + Math.sin(a) * r1;
              const x2 = CX + Math.cos(a) * r2;
              const y2 = CY + Math.sin(a) * r2;
              const isMain = h % 6 === 0;
              return (
                <g key={h}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isMain ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'} strokeWidth={isMain ? 1.4 : 0.8} />
                  {isMain && (
                    <text
                      x={CX + Math.cos(a) * (r2 + 14)}
                      y={CY + Math.sin(a) * (r2 + 14) + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fill="rgba(255,255,255,0.55)"
                      letterSpacing="2"
                    >
                      {String(h).padStart(2, '0')}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Recommended sleep window */}
            <motion.path
              d={arcPath(recommendedSleep, recommendedWake, R_INNER - 12)}
              fill="none"
              stroke={PRISM.creative}
              strokeWidth="6"
              strokeLinecap="round"
              strokeOpacity="0.85"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: 0.3 }}
            />

            {/* "Now" hand */}
            {(() => {
              const a = angleFor(hourNow);
              const x = CX + Math.cos(a) * (R_OUTER - 4);
              const y = CY + Math.sin(a) * (R_OUTER - 4);
              return (
                <g>
                  <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--fg)" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx={CX} cy={CY} r={4} fill="var(--fg)" />
                  <circle cx={x} cy={y} r={5} fill="var(--fg)" />
                </g>
              );
            })()}

            {/* Center text */}
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)" letterSpacing="3">
              NOW
            </text>
            <text x={CX} y={CY + 14} textAnchor="middle" fontSize="22" fill="var(--fg)" fontFamily="ui-monospace, monospace" fontWeight="200">
              {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] tracking-[0.3em] text-fg-subtle">推奨タイムテーブル</div>
          {ZONES.map((z) => (
            <div key={z.name} className="flex items-center justify-between rounded-md bg-surface-2 px-2 py-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: z.color }} />
                <span className="text-[13px] text-fg">{z.name}</span>
              </div>
              <span className="font-mono text-[12px] text-fg-muted">
                {fmtHour(z.start)}–{fmtHour(z.end > 24 ? z.end - 24 : z.end)}
              </span>
            </div>
          ))}
          <div className="mt-2 rounded-md border border-white/8 bg-surface-2 px-2 py-2 text-[14px] text-fg-muted">
            <span className="text-fg-subtle">推奨入眠:</span> {fmtHour(recommendedSleep)} →{' '}
            <span className="text-fg-subtle">起床:</span> {fmtHour(recommendedWake > 24 ? recommendedSleep - 24 : recommendedWake - 24)}
            <br />
            <span className="text-fg-subtle">睡眠枠:</span>{' '}
            <span className="font-mono text-fg">{sleepDuration.toFixed(1)}h</span>
            <span className="ml-2 text-fg-subtle">
              週平均: <span className="font-mono text-fg">{weekAvgSleep.toFixed(1)}h</span>
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[12px] text-fg-subtle">
        体内時計に沿った活動配分で、認知パフォーマンス・代謝・睡眠の質が連動して向上します。
      </p>
    </div>
  );
}

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const dh = ((hh % 24) + 24) % 24;
  return `${String(dh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
