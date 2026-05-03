import { motion } from 'framer-motion';
import { Heart, Moon, Activity, Brain, Apple, Sparkles, AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-react';
import { PRISM, Pill, StatCard } from '../prism/MockShell';
import { spectrumFromDay, generateMockInsights } from '../../data/mockHealth';
import { DailyBrief } from './DailyBrief';
import { PersonaGoals } from './PersonaGoals';
import { TodaysPrescription } from './TodaysPrescription';
import { QuickLog } from './QuickLog';
import { Achievements } from './Achievements';
import { HealthHeatmap } from './HealthHeatmap';
import type { useHealth } from '../../hooks/useHealth';
import type { MedicalProfile } from '../../types/health';
import type { HealthAnomaly } from '../../data/healthAnomaly';
import type { Persona } from '../../types/identity';

interface Props {
  health: ReturnType<typeof useHealth>;
  med: MedicalProfile;
  anomalies?: HealthAnomaly[];
  onAskCoach?: (question: string) => void;
  userName?: string;
  persona?: Persona;
}

const AXIS_META = {
  sleep:     { color: PRISM.logic,    Icon: Moon,     label: 'SLEEP' },
  recovery:  { color: PRISM.empathy,  Icon: Heart,    label: 'RECOVERY' },
  activity:  { color: PRISM.action,   Icon: Activity, label: 'ACTIVITY' },
  mind:      { color: PRISM.creative, Icon: Brain,    label: 'MIND' },
  nutrition: { color: PRISM.ethics,   Icon: Apple,    label: 'NUTRITION' },
} as const;

export function HealthOverview({ health, med, anomalies = [], onAskCoach, userName, persona }: Props) {
  const today = health.today;
  if (!today) return <div className="p-8 text-center text-fg-muted">データを準備中...</div>;
  const spectrum = spectrumFromDay(today);
  const vitals = Math.round(
    (spectrum.sleep + spectrum.recovery + spectrum.activity + spectrum.mind + spectrum.nutrition) / 5
  );
  const insights = generateMockInsights(health.days);

  return (
    <div className="flex flex-col gap-4">
      {/* Daily Brief — 朝の挨拶 + 状態1行サマリ */}
      <DailyBrief today={today} anomalies={anomalies} userName={userName} />

      {/* Today's Prescription — AI 1日プラン */}
      {persona && (
        <TodaysPrescription today={today} anomalies={anomalies} persona={persona} />
      )}

      {/* ペルソナ連動の目標 */}
      {persona && <PersonaGoals health={health} persona={persona} />}

      {/* クイックログ */}
      <QuickLog profile={med} />

      {/* 30日ヒートマップ */}
      <HealthHeatmap days={health.days} />

      {/* 達成バッジ */}
      <Achievements health={health} />

      {/* Header line */}
      <div className="flex items-center justify-between">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">TODAY · {today.date}</div>
        <div className="flex items-center gap-2">
          <Pill color={PRISM.empathy}>HEALTH · {vitals}</Pill>
          {med.conditions.length > 0 && (
            <Pill color={PRISM.ethics}>{med.conditions.length} 既往歴</Pill>
          )}
          {med.medications.length > 0 && (
            <Pill color={PRISM.action}>{med.medications.length} 服用中</Pill>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-3">
        {/* Vitals Ring */}
        <div className="glass relative flex flex-col items-center justify-center rounded-2xl p-5">
          <svg viewBox="0 0 200 200" className="h-[200px] w-[200px]">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={PRISM.logic} />
                <stop offset="50%" stopColor={PRISM.empathy} />
                <stop offset="100%" stopColor={PRISM.action} />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <motion.circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 85}
              initial={{ strokeDashoffset: 2 * Math.PI * 85 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 85 * (1 - vitals / 100) }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              transform="rotate(-90 100 100)"
            />
            <text x="100" y="98" textAnchor="middle" fill="var(--fg)" fontSize="42" fontWeight="200" fontFamily="ui-monospace, monospace">
              {vitals}
            </text>
            <text x="100" y="120" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" letterSpacing="3">
              VITALS · TODAY
            </text>
          </svg>
          <div className="mt-2 text-center text-[13px] text-fg-muted">
            5軸の総合健康スコア
          </div>
        </div>

        {/* 5-axis spectrum */}
        <div className="glass rounded-2xl p-4">
          <div className="text-[12px] tracking-[0.4em] text-fg-muted">PRISM HEALTH SPECTRUM</div>
          <div className="mt-4 flex flex-col gap-2.5">
            {(Object.keys(AXIS_META) as Array<keyof typeof AXIS_META>).map((k) => {
              const meta = AXIS_META[k];
              const v = spectrum[k];
              return (
                <div key={k} className="grid grid-cols-[28px_72px_1fr_36px] items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-md"
                    style={{ background: `${meta.color}1A`, border: `1px solid ${meta.color}40` }}
                  >
                    <meta.Icon className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: meta.color }} />
                  </span>
                  <span className="text-[12px] tracking-[0.3em]" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: meta.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${v}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-right font-mono text-[13px] text-fg-muted">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="SLEEP" value={today.sleepHours.toFixed(1)} unit="h" delta={`深 ${today.deepSleepMin}分 / REM ${today.remSleepMin}分`} color={PRISM.logic} />
        <StatCard label="HRV" value={String(today.hrv)} unit="ms" delta={`安静時 ${today.restingHR} bpm`} color={PRISM.empathy} />
        <StatCard label="STEPS" value={today.steps.toLocaleString()} delta={`活動 ${today.activeMinutes}分 / ${today.exerciseKcal}kcal`} color={PRISM.action} />
        <StatCard label="STRESS" value={String(today.stressLevel)} delta={`Mindful ${today.mindfulMinutes}分 / 水分 ${today.hydrationL}L`} color={PRISM.creative} />
      </div>

      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-[12px] tracking-[0.4em] text-fg-muted">⚠ ANOMALY DETECTION · 異常検知</div>
            <Pill color={anomalies.some(a => a.severity === 'alert') ? '#FF6F6F' : PRISM.action}>
              {anomalies.length} 件
            </Pill>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {anomalies.slice(0, 4).map((a) => {
              const sevColor =
                a.severity === 'alert' ? '#FF6F6F'
                : a.severity === 'caution' ? PRISM.action
                : PRISM.logic;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/8 bg-surface-2 p-3"
                  style={{ boxShadow: `inset 0 0 0 1px ${sevColor}30` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: sevColor }}
                        />
                        <span className="text-[14px] font-medium text-fg">{a.title}</span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{a.detail}</p>
                    </div>
                    <Pill color={sevColor}>
                      {a.severity === 'alert' ? '注意' : a.severity === 'caution' ? '留意' : 'INFO'}
                    </Pill>
                  </div>
                  {a.suggestedQuestion && onAskCoach && (
                    <button
                      onClick={() => onAskCoach(a.suggestedQuestion!)}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-surface-3 px-2 py-1 text-[12px] text-fg-muted hover:bg-surface-3"
                    >
                      <MessageCircle className="h-3 w-3" /> AI Coach に聞く
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-[12px] tracking-[0.4em] text-fg-muted">AI INSIGHTS · 今日のインサイト</div>
          <Pill color={PRISM.creative}><Sparkles className="mr-1 h-2.5 w-2.5" />PHR + 既往歴 連動</Pill>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {insights.map((it) => {
            const meta = AXIS_META[it.axis];
            const sevColor =
              it.severity === 'alert' ? '#FF6F6F'
              : it.severity === 'caution' ? PRISM.action
              : it.severity === 'celebrate' ? PRISM.ethics
              : PRISM.logic;
            return (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-[28px_1fr_auto] items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
              >
                <span
                  className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: `${meta.color}1A`, border: `1px solid ${meta.color}40` }}
                >
                  {it.severity === 'alert' ? (
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#FF6F6F' }} />
                  ) : it.severity === 'celebrate' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: PRISM.ethics }} />
                  ) : (
                    <meta.Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  )}
                </span>
                <div>
                  <div className="text-[14px] text-fg">{it.title}</div>
                  <div className="mt-1 text-[13px] text-fg-muted">{it.detail}</div>
                </div>
                <Pill color={sevColor}>
                  {it.severity === 'alert' ? '注意' : it.severity === 'caution' ? '留意' : it.severity === 'celebrate' ? 'GOOD' : 'INFO'}
                </Pill>
              </motion.div>
            );
          })}
          {insights.length === 0 && (
            <div className="rounded-xl bg-surface-2 p-4 text-center text-[13px] text-fg-subtle">
              異常なサインなし。コンディション安定中。
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[12px] text-fg-subtle">
        本機能は予防医療の参考情報であり、医学的診断ではありません。
      </p>
    </div>
  );
}
