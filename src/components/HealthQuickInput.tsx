// ============================================================
// HealthQuickInput — 5 秒で終わる「かんたん体調入力」
//
// オーナー指示 (2026-05-18): iOS ショートカット連携は一般人には難しい。
// もっと簡単に。→ Apple Watch が無くても、3 タップで今日の体調を記録。
//
// 入力した値から DailyHealth を組み立て、localStorage に保存。
// WellnessTracker / HealthSnapshot がそのまま読む。
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Moon, Smile, Footprints } from 'lucide-react';
import type { DailyHealth } from '../types/health';

const KEY_DAYS = 'core_phr_daily_v1';

interface Props {
  accent?: string;
  onSaved?: () => void;
}

const MOODS = [
  { v: 1, emoji: '😫', label: 'つらい' },
  { v: 2, emoji: '😪', label: 'いまいち' },
  { v: 3, emoji: '😐', label: 'ふつう' },
  { v: 4, emoji: '🙂', label: 'good' },
  { v: 5, emoji: '😄', label: '絶好調' },
];

const ACTIVITY = [
  { v: 'low',  label: 'あまり', steps: 3000,  min: 10 },
  { v: 'mid',  label: 'ふつう', steps: 7000,  min: 30 },
  { v: 'high', label: 'たくさん', steps: 12000, min: 60 },
];

function buildDay(sleepH: number, mood: number, act: typeof ACTIVITY[number]): DailyHealth {
  const sleepScore =
    sleepH >= 7 && sleepH <= 8.5 ? 92 :
    sleepH >= 6 && sleepH < 7 ? 76 :
    sleepH > 8.5 ? 80 :
    sleepH >= 5 ? 58 : 42;
  return {
    date: new Date().toISOString().slice(0, 10),
    sleepHours: sleepH,
    deepSleepMin: Math.round(sleepH * 60 * 0.20),
    remSleepMin: Math.round(sleepH * 60 * 0.22),
    sleepScore,
    hrv: 44 + mood * 6,
    restingHR: 68 - mood * 2,
    recoveryScore: Math.min(100, mood * 18 + 10),
    steps: act.steps,
    activeMinutes: act.min,
    exerciseKcal: act.min * 7,
    stressLevel: (6 - mood) * 15,
    mindfulMinutes: 0,
    hydrationL: 1.5,
    caffeineMg: 0,
    alcoholDrinks: 0,
  };
}

export default function HealthQuickInput({ accent = '#8E5CFF', onSaved }: Props) {
  const [sleepH, setSleepH] = useState(7);
  const [mood, setMood] = useState(0);
  const [act, setAct] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const ready = mood > 0 && act !== null;

  const save = () => {
    const actObj = ACTIVITY.find(a => a.v === act)!;
    const day = buildDay(sleepH, mood, actObj);
    try {
      const raw = localStorage.getItem(KEY_DAYS);
      const days: DailyHealth[] = raw ? JSON.parse(raw) : [];
      const idx = days.findIndex(d => d.date === day.date);
      if (idx >= 0) days[idx] = day;
      else days.push(day);
      days.sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem(KEY_DAYS, JSON.stringify(days.slice(-60)));
    } catch { /* */ }
    setSaved(true);
    if ('vibrate' in navigator) (navigator as any).vibrate?.(20);
    setTimeout(() => {
      onSaved?.();
      window.location.reload(); // 体調データを画面全体に反映
    }, 1100);
  };

  if (saved) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{
          borderRadius: 18, padding: '1.3rem', textAlign: 'center',
          background: 'rgba(16,185,129,0.12)', border: '1px solid #10B98155',
        }}
      >
        <Check size={28} color="#10B981" style={{ marginBottom: 4 }} />
        <div style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>
          今日の体調を記録しました
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
          画面に反映しています…
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{
      borderRadius: 18, padding: '1.1rem 1.2rem',
      background: `linear-gradient(135deg, ${accent}1A, rgba(255,255,255,0.015))`,
      border: `1px solid ${accent}33`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 800, color: accent }}>
          かんたん体調入力 · 5 秒
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 14, lineHeight: 1.5 }}>
        Apple Watch がなくても OK。3 つ選ぶだけで、AI があなたの体調を見守ります。
      </p>

      {/* ① 睡眠 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <Moon size={13} color={accent} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>昨夜の睡眠</span>
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: accent }}>
            {sleepH} 時間
          </span>
        </div>
        <input
          type="range" min={4} max={10} step={0.5}
          value={sleepH}
          onChange={e => setSleepH(Number(e.target.value))}
          style={{ width: '100%', accentColor: accent }}
        />
      </div>

      {/* ② 気分 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <Smile size={13} color={accent} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>今朝の調子</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {MOODS.map(m => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMood(m.v)}
              style={{
                flex: 1, padding: '8px 2px', borderRadius: 11, cursor: 'pointer',
                background: mood === m.v ? `${accent}33` : 'rgba(255,255,255,0.04)',
                border: mood === m.v ? `1.5px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 20 }}>{m.emoji}</span>
              <span style={{ fontSize: 8.5, color: mood === m.v ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ③ 活動 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <Footprints size={13} color={accent} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>昨日 動いた量</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ACTIVITY.map(a => (
            <button
              key={a.v}
              type="button"
              onClick={() => setAct(a.v)}
              style={{
                flex: 1, padding: '9px 2px', borderRadius: 11, cursor: 'pointer',
                background: act === a.v ? `${accent}33` : 'rgba(255,255,255,0.04)',
                border: act === a.v ? `1.5px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
                fontSize: 11.5, fontWeight: 800,
                color: act === a.v ? '#fff' : 'rgba(255,255,255,0.55)',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!ready}
        style={{
          width: '100%', fontSize: 13, fontWeight: 800, color: '#fff',
          background: ready ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : 'rgba(255,255,255,0.08)',
          border: 'none', borderRadius: 999, padding: '11px 16px',
          cursor: ready ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {ready ? <>記録する <Check size={14} /></> : '3 つ選んでください'}
      </button>
    </div>
  );
}
