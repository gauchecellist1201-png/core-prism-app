import { motion } from 'framer-motion';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import { isDemoActive } from '../lib/onboarding';
import SampleDataCTA from './SampleDataCTA';

interface Props {
  today: DailyHealth | null;
  week: DailyHealth[];
  anomalies: HealthAnomaly[];
  onOpen: () => void;
}

interface MetricSpec {
  key: keyof DailyHealth | 'recovery' | 'sleep' | 'steps' | 'mind';
  label: string;
  emoji: string;
  format: (v: number) => string;
  color: (v: number, avg: number) => string;
  good: (v: number) => boolean;
}

const METRICS: MetricSpec[] = [
  {
    key: 'sleepHours',
    label: '睡眠',
    emoji: '😴',
    format: v => `${v.toFixed(1)}h`,
    color: (v) => v >= 7 ? '#34d399' : v >= 6 ? '#c9a96e' : '#f87171',
    good: v => v >= 7,
  },
  {
    key: 'recoveryScore',
    label: '回復',
    emoji: '🔋',
    format: v => `${Math.round(v)}`,
    color: v => v >= 75 ? '#34d399' : v >= 55 ? '#c9a96e' : '#f87171',
    good: v => v >= 75,
  },
  {
    key: 'hrv',
    label: 'HRV',
    emoji: '❤',
    format: v => `${Math.round(v)}ms`,
    color: (v, avg) => avg <= 0 ? '#c9a96e' : v >= avg * 0.95 ? '#34d399' : v >= avg * 0.85 ? '#c9a96e' : '#f87171',
    good: v => v > 0,
  },
  {
    key: 'steps',
    label: '歩数',
    emoji: '🚶',
    format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`,
    color: v => v >= 8000 ? '#34d399' : v >= 5000 ? '#c9a96e' : '#f87171',
    good: v => v >= 8000,
  },
  {
    key: 'stressLevel',
    label: 'ストレス',
    emoji: '🌪',
    format: v => `${Math.round(v)}`,
    color: v => v <= 35 ? '#34d399' : v <= 55 ? '#c9a96e' : '#f87171',
    good: v => v <= 35,
  },
  {
    key: 'mindfulMinutes',
    label: '瞑想',
    emoji: '🧘',
    format: v => `${Math.round(v)}m`,
    color: v => v >= 10 ? '#34d399' : v >= 5 ? '#c9a96e' : 'var(--fg-muted)',
    good: v => v >= 10,
  },
];

export default function HealthSnapshot({ today, week, anomalies, onOpen }: Props) {
  if (!today) {
    return (
      <motion.div
        className="w-full rounded-2xl p-3"
        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      >
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left transition-all"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <p className="text-fg text-base font-medium mb-1">🩺 ヘルス</p>
          <p className="text-fg-muted text-sm">睡眠・回復・歩数を入れると、AI が体調を踏まえて「今日のリズム」を提案します</p>
          <p className="text-fg-muted text-xs mt-1.5" style={{ opacity: 0.7 }}>タップで Apple Health 連携 / 手入力に進む →</p>
        </button>
        {!isDemoActive() && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <SampleDataCTA
              accent="#8E5CFF"
              hint="サンプルの 7 日間データが入り、AI の体調アドバイス・異常検知をすぐ体験できます"
            />
          </div>
        )}
      </motion.div>
    );
  }

  const avgs: Record<string, number> = {};
  for (const k of ['sleepHours', 'recoveryScore', 'hrv', 'steps', 'stressLevel', 'mindfulMinutes']) {
    const vals = week.map(d => Number((d as any)[k] || 0));
    avgs[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  const alertCount = anomalies.filter(a => a.severity !== 'info').length;

  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
    >
      <button
        onClick={onOpen}
        className="w-full px-3 pt-3 pb-2 hover:bg-surface transition-colors text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🩺</span>
            <p className="text-fg text-base font-medium">今日のヘルス</p>
            {alertCount > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
              >
                ⚠ {alertCount}件の注意
              </span>
            )}
          </div>
          <span className="text-fg-muted text-xs">詳細 →</span>
        </div>
        <p className="text-fg-muted text-[10px] mt-0.5 leading-snug">今日のからだの状態。色が緑=良好 / 黄=ふつう / 赤=注意。タップで 7 日分のグラフへ。</p>
      </button>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 px-3 pb-3">
        {METRICS.map((m, i) => {
          const rawVal = (today as any)[m.key];
          const missing = rawVal == null || rawVal === 0;
          const raw = rawVal ?? 0;
          const avg = avgs[m.key as string] ?? 0;
          const color = missing ? 'var(--fg-muted)' : m.color(raw, avg);
          return (
            <motion.div
              key={m.key as string}
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-lg"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${color}30`,
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.04 }}
            >
              <span className="text-lg leading-none">{m.emoji}</span>
              <span className="text-base font-semibold leading-tight mt-1" style={{ color }}>
                {missing ? '—' : m.format(raw)}
              </span>
              <span className="text-fg-muted text-[10px] leading-tight">{m.label}</span>
            </motion.div>
          );
        })}
      </div>

      {/* 主要な異常を1件 */}
      {anomalies.length > 0 && (
        <div className="px-3 pb-3">
          <button
            onClick={onOpen}
            className="w-full text-left p-2.5 rounded-lg flex items-start gap-2 transition-all"
            style={{
              background: anomalies[0].severity === 'alert' ? 'rgba(248,113,113,0.1)' : 'rgba(201,169,110,0.1)',
              border: `1px solid ${anomalies[0].severity === 'alert' ? 'rgba(248,113,113,0.3)' : 'rgba(201,169,110,0.3)'}`,
            }}
          >
            <span style={{ color: anomalies[0].severity === 'alert' ? '#f87171' : '#c9a96e' }} className="text-sm flex-shrink-0">
              ⚠
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-fg text-sm font-medium truncate">{anomalies[0].title}</p>
              <p className="text-fg-muted text-xs mt-0.5 line-clamp-2">{anomalies[0].detail}</p>
            </div>
          </button>
        </div>
      )}
    </motion.div>
  );
}
