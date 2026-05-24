import { useMemo, useState } from 'react';
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
import WeeklyAiSummary from './WeeklyAiSummary';
import { detectAnomalies } from '../../data/healthAnomaly';
import type { useHealth } from '../../hooks/useHealth';
import type { MedicalProfile, DailyHealth } from '../../types/health';
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

      {/* 今週のサマリ — AI 1 日 1 回キャッシュ + Agent 委任 */}
      <WeeklyAiSummary days={health.days} />

      {/* Today's Prescription — AI 1日プラン */}
      {persona && (
        <TodaysPrescription today={today} anomalies={anomalies} persona={persona} />
      )}

      {/* ペルソナ連動の目標 */}
      {persona && <PersonaGoals health={health} persona={persona} />}

      {/* クイックログ */}
      <QuickLog profile={med} />

      {/* 異常検知の可視化 — 7 日分のチップ */}
      <DailyAnomalyChips days={health.days} />

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

// ─────────────────────────────────────────────────────────────
// 7 日分の「⚠ 注意 / ✓ 順調」チップ
// 各日のサブセットを detectAnomalies に渡し、tap で詳細を開く
// ─────────────────────────────────────────────────────────────
function DailyAnomalyChips({ days }: { days: DailyHealth[] }) {
  const week = days.slice(-7);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const perDay = useMemo(() => {
    return week.map((d, i) => {
      const upto = days.slice(0, days.length - (week.length - 1 - i));
      // 直近 15 日のウィンドウで判定 (detectAnomalies の要件)
      const window = upto.slice(-15);
      const anomalies = detectAnomalies(window);
      const hasAlert = anomalies.some(a => a.severity === 'alert');
      const hasCaution = anomalies.some(a => a.severity === 'caution');
      const status: 'alert' | 'caution' | 'ok' =
        hasAlert ? 'alert' : hasCaution ? 'caution' : 'ok';
      return { date: d.date, status, anomalies };
    });
  }, [week, days]);

  if (week.length === 0) return null;
  const open = openIdx !== null ? perDay[openIdx] : null;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] tracking-[0.4em] text-fg-muted">7 日の調子</div>
        <div className="text-[11px] text-fg-subtle">タップで詳細</div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
        {perDay.map((p, i) => {
          const sev = p.status;
          const color = sev === 'alert' ? '#FF6F6F' : sev === 'caution' ? '#FB923C' : '#10B981';
          const icon = sev === 'ok' ? '✓' : '⚠';
          const label = sev === 'alert' ? '注意' : sev === 'caution' ? '留意' : '順調';
          const d = new Date(p.date);
          const dayShort = `${d.getMonth() + 1}/${d.getDate()}`;
          const active = openIdx === i;
          return (
            <button
              key={p.date}
              type="button"
              onClick={() => setOpenIdx(active ? null : i)}
              className="flex flex-col items-center gap-1 rounded-xl border bg-white/3 px-1 py-2 transition hover:bg-white/8"
              style={{
                borderColor: active ? color : 'rgba(255,255,255,0.08)',
                boxShadow: active ? `0 0 0 1px ${color}` : undefined,
                minHeight: 64,
              }}
              aria-label={`${dayShort} ${label}`}
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
              >
                {icon}
              </span>
              <span className="text-[10px] text-fg-subtle leading-none">{dayShort}</span>
              <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl border border-white/10 bg-surface-2 p-3"
        >
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium text-fg">{open.date} の詳細</div>
            <button
              type="button"
              onClick={() => setOpenIdx(null)}
              className="text-[11px] text-fg-subtle hover:text-fg"
              aria-label="閉じる"
            >閉じる</button>
          </div>
          {open.anomalies.length === 0 ? (
            <div className="mt-2 flex items-center gap-1.5 text-[13px] text-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> 異常なサインなし。コンディション良好です。
            </div>
          ) : (
            <ul className="mt-2 grid gap-1.5">
              {open.anomalies.slice(0, 3).map(a => {
                const c = a.severity === 'alert' ? '#FF6F6F' : a.severity === 'caution' ? '#FB923C' : '#A78BFA';
                return (
                  <li key={a.id} className="flex items-start gap-2 text-[13px] text-fg">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: c }} />
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="mt-0.5 text-[12.5px] text-fg-muted leading-relaxed">{a.detail}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}
