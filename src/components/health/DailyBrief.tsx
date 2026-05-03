import { motion } from 'framer-motion';
import { Sun, Moon, Sunrise, Sunset, Sparkles } from 'lucide-react';
import { PRISM, Pill } from '../prism/MockShell';
import type { DailyHealth } from '../../types/health';
import type { HealthAnomaly } from '../../data/healthAnomaly';

interface Props {
  today: DailyHealth;
  anomalies: HealthAnomaly[];
  userName?: string;
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { text: '深夜です。', Icon: Moon, color: PRISM.creative };
  if (h < 11) return { text: 'おはようございます', Icon: Sunrise, color: PRISM.action };
  if (h < 17) return { text: 'こんにちは', Icon: Sun, color: PRISM.ethics };
  if (h < 22) return { text: 'お疲れさまです', Icon: Sunset, color: PRISM.empathy };
  return { text: 'もう休む時間です', Icon: Moon, color: PRISM.creative };
}

function composeBrief(today: DailyHealth, anomalies: HealthAnomaly[]): string {
  const parts: string[] = [];

  // 睡眠
  if (today.sleepHours >= 7.5) parts.push(`昨夜は${today.sleepHours.toFixed(1)}h と十分な睡眠`);
  else if (today.sleepHours >= 6.5) parts.push(`昨夜の睡眠 ${today.sleepHours.toFixed(1)}h（やや短め）`);
  else parts.push(`昨夜の睡眠 ${today.sleepHours.toFixed(1)}h と短く、判断のキレに注意`);

  // HRV / リカバリー
  if (today.recoveryScore >= 75) parts.push(`リカバリー${today.recoveryScore}— 攻めて良い日`);
  else if (today.recoveryScore >= 60) parts.push(`リカバリー${today.recoveryScore}— 平常運転`);
  else parts.push(`リカバリー${today.recoveryScore}— 重要判断は午前中に`);

  // ストレス
  if (today.stressLevel >= 70) parts.push('ストレス指数 高め');
  else if (today.stressLevel >= 50) parts.push('ストレスやや高');

  // アクション
  const alertCount = anomalies.filter((a) => a.severity !== 'info').length;
  if (alertCount > 0) parts.push(`${alertCount} 件の自動検知あり`);

  return parts.join('。') + '。';
}

export function DailyBrief({ today, anomalies, userName }: Props) {
  const greeting = timeGreeting();
  const text = composeBrief(today, anomalies);
  const alertCount = anomalies.filter((a) => a.severity !== 'info').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="glass relative overflow-hidden rounded-3xl p-5"
      style={{
        background:
          'linear-gradient(135deg, rgba(255,111,181,0.10) 0%, rgba(176,124,255,0.08) 50%, rgba(255,159,69,0.10) 100%)',
        boxShadow: '0 30px 80px -50px rgba(255,111,181,0.4)',
      }}
    >
      {/* Decorative blur */}
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
        style={{ background: greeting.color }}
      />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ background: `${greeting.color}20`, border: `1px solid ${greeting.color}55` }}
          >
            <greeting.Icon className="h-3.5 w-3.5" style={{ color: greeting.color }} />
          </span>
          <span className="text-[12px] tracking-[0.4em] text-fg-muted">
            DAILY BRIEF · {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
          </span>
          {alertCount > 0 && <Pill color={PRISM.action}>注意点 {alertCount}</Pill>}
        </div>

        <h3 className="mt-3 text-[20px] font-light text-fg">
          <span style={{ color: greeting.color }}>{greeting.text}</span>
          {userName && <span className="text-fg">、{userName}さん。</span>}
        </h3>

        <p className="mt-2 text-[13.5px] leading-relaxed text-fg">{text}</p>

        <div className="mt-4 grid grid-cols-4 gap-3">
          <Cell label="睡眠" value={`${today.sleepHours.toFixed(1)}h`} color={PRISM.logic} />
          <Cell label="HRV" value={`${today.hrv}ms`} color={PRISM.empathy} />
          <Cell label="歩数" value={today.steps.toLocaleString()} color={PRISM.action} />
          <Cell label="ストレス" value={String(today.stressLevel)} color={PRISM.creative} />
        </div>

        <div className="mt-4 flex items-center gap-2 text-[12px] text-fg-subtle">
          <Sparkles className="h-3 w-3" />
          AIが PHR + 既往歴 + 服薬から自動構成
        </div>
      </div>
    </motion.div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-surface-3 p-2.5">
      <div className="text-[11px] tracking-[0.3em] text-fg-subtle">{label}</div>
      <div className="mt-1 font-mono text-[18px] font-light" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
