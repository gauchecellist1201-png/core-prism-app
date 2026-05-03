import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import type { DailyHealth } from '../types/health';

interface Props {
  persona: Persona;
  today: DailyHealth | null;
  week: DailyHealth[];
  taskOpen: number;
  taskDone: number;
}

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function greeting(h: number): { jp: string; en: string; emoji: string } {
  if (h < 5)  return { jp: '深夜です', en: 'LATE NIGHT',  emoji: '🌙' };
  if (h < 11) return { jp: 'おはよう', en: 'MORNING',     emoji: '☀️' };
  if (h < 14) return { jp: 'こんにちは', en: 'MIDDAY',     emoji: '🌤' };
  if (h < 18) return { jp: 'お疲れさまです', en: 'AFTERNOON',  emoji: '🌅' };
  if (h < 22) return { jp: 'こんばんは', en: 'EVENING',     emoji: '🌆' };
  return       { jp: 'お疲れさま',   en: 'NIGHT',        emoji: '🌙' };
}

function whisper(persona: Persona, today: DailyHealth | null, taskOpen: number, hour: number): string {
  if (today) {
    if (today.recoveryScore < 50) return '回復スコアが低め。重い決断は午後に。';
    if (today.sleepHours < 6) return `睡眠 ${today.sleepHours.toFixed(1)}h。判断系より作業系を優先。`;
    if (today.hrv && today.hrv < 35) return 'HRV が低め。深呼吸で副交感神経を起動。';
    if (today.recoveryScore >= 75 && hour < 14) return '回復十分。重要な意思決定はいま。';
  }
  if (taskOpen > 8) return `未完了 ${taskOpen}件。優先1件に絞る時間。`;
  if (hour >= 20)   return '今日のレビューと、明日の最優先1件を確定。';
  if (hour < 11)    return `${persona.name} として、今日の1手を決めましょう。`;
  return '次の30分で動かす1手は何？';
}

export default function MomentPulse({ persona, today, week, taskOpen, taskDone }: Props) {
  const now = useNow();
  const hour = now.getHours();
  const min = now.getMinutes();
  const sec = now.getSeconds();
  const g = greeting(hour);

  const recovery = today?.recoveryScore ?? 0;
  const sleep = today?.sleepHours ?? 0;
  const hrv = today?.hrv ?? 0;
  const stress = today?.stressLevel ?? 0;
  const steps = today?.steps ?? 0;
  const stepGoal = 8000;

  // 進捗: タスクの完了率
  const taskTotal = taskOpen + taskDone;
  const taskPct = taskTotal === 0 ? 0 : Math.round((taskDone / taskTotal) * 100);

  // 中央リング: 回復スコア (Health 未接続時はタスク完了率)
  const mainScore = today ? recovery : taskPct;
  const mainLabel = today ? 'RECOVERY' : 'TASKS';
  const mainSub = today ? '回復スコア' : 'タスク完了率';
  const mainColor = scoreToColor(mainScore, persona.accentColor);

  // HRV mini sparkline (過去7日)
  const hrvSeries = useMemo(() => week.map(d => d.hrv || 0).slice(-7), [week]);

  // breathing: 4秒で 0 → 1 → 0 を緩やかに
  const breath = 0.5 + 0.5 * Math.sin((Date.now() / 1000) * (Math.PI / 2.0));

  return (
    <motion.div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: `linear-gradient(135deg, ${persona.accentColor}10, var(--surface-3))`,
        border: `1px solid ${persona.accentColor}33`,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
    >
      {/* 動くグロー */}
      <motion.div
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: persona.accentColor, filter: 'blur(70px)', opacity: 0.18 }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-12 -left-10 w-44 h-44 rounded-full pointer-events-none"
        style={{ background: '#FF6FB5', filter: 'blur(70px)', opacity: 0.08 }}
        animate={{ x: [0, 10, 0], y: [0, 8, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ヘッダ: いまの瞬間 */}
      <div className="relative px-3 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{g.emoji}</span>
          <div className="min-w-0">
            <p className="text-fg text-sm font-medium leading-tight truncate">{g.jp}、{persona.name}</p>
            <p className="text-fg-muted text-[10px] tracking-widest">{g.en} · NOW</p>
          </div>
        </div>
        {/* 動くデジタル時計 */}
        <div className="flex items-baseline gap-0.5 font-mono">
          <span className="text-fg text-lg font-semibold">{String(hour).padStart(2, '0')}</span>
          <motion.span
            className="text-fg text-lg font-semibold"
            animate={{ opacity: sec % 2 === 0 ? 1 : 0.35 }}
            transition={{ duration: 0.2 }}
          >:</motion.span>
          <span className="text-fg text-lg font-semibold">{String(min).padStart(2, '0')}</span>
          <span className="text-fg-muted text-xs ml-1">{String(sec).padStart(2, '0')}</span>
        </div>
      </div>

      {/* 中央リング (Recovery / Tasks) */}
      <div className="relative px-3 pt-1 flex items-center gap-3">
        <RadialScore value={mainScore} color={mainColor} breath={breath} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-[0.3em] text-fg-muted uppercase">{mainLabel}</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-fg text-3xl font-light leading-none" style={{ color: mainColor }}>{mainScore}</span>
            <span className="text-fg-muted text-xs">/ 100</span>
          </div>
          <p className="text-fg-muted text-[11px] mt-1">
            {mainSub} ·{' '}
            <span style={{ color: mainColor }}>{scoreLabel(mainScore)}</span>
          </p>
        </div>
      </div>

      {/* 4 mini stats (sleep / hrv / steps / stress) */}
      <div className="relative grid grid-cols-4 gap-1 px-3 mt-3">
        <MiniStat
          label="睡眠"
          value={today ? `${sleep.toFixed(1)}h` : '—'}
          color="#B57CFF"
          score={Math.min(100, (sleep / 8) * 100)}
        />
        <MiniStat
          label="HRV"
          value={today && hrv > 0 ? `${hrv}ms` : '—'}
          color="#5BA8FF"
          score={Math.min(100, (hrv / 70) * 100)}
          sparkline={hrvSeries}
        />
        <MiniStat
          label="歩数"
          value={today ? formatSteps(steps) : '—'}
          color="#4ADE80"
          score={Math.min(100, (steps / stepGoal) * 100)}
        />
        <MiniStat
          label="ストレス"
          value={today ? `${stress}` : '—'}
          color="#FF6FB5"
          score={Math.max(0, 100 - stress)}
          inverse
        />
      </div>

      {/* AI ささやき */}
      <div className="relative px-3 pt-3 pb-3 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-start gap-2">
          <motion.span
            className="text-base mt-0.5"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >✨</motion.span>
          <p className="text-fg text-xs leading-relaxed flex-1">
            {whisper(persona, today, taskOpen, hour)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── 中央の円形スコアリング ──────────────────────────
function RadialScore({ value, color, breath }: { value: number; color: string; breath: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="relative w-[88px] h-[88px] flex-shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        {/* 外側 ring (薄) */}
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        {/* グロー */}
        <motion.circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: `drop-shadow(0 0 ${6 + breath * 8}px ${color})` }}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c}` }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {/* 中心の点 (息づき) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-3 h-3 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      </motion.div>
    </div>
  );
}

// ─── ミニ統計 ────────────────────────────────────
function MiniStat({
  label, value, color, score, sparkline, inverse,
}: {
  label: string; value: string; color: string; score: number; sparkline?: number[]; inverse?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div
      className="rounded-lg px-2 py-1.5 relative overflow-hidden"
      style={{ background: 'var(--surface)' }}
    >
      <p className="text-[9px] tracking-wider text-fg-muted uppercase">{label}</p>
      <p className="text-fg text-sm font-medium mt-0.5 truncate">{value}</p>
      {sparkline && sparkline.length > 1 ? (
        <div className="mt-1 h-2.5">
          <Sparkline values={sparkline} color={color} />
        </div>
      ) : (
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: color, boxShadow: `0 0 4px ${color}` }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, delay: 0.1 }}
          />
        </div>
      )}
      {/* inverse は warning, otherwise OK */}
      {inverse && pct < 40 && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: '#FF6B6B' }} />
      )}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 100, h = 100;
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function scoreLabel(v: number): string {
  if (v >= 80) return '絶好調';
  if (v >= 65) return '好調';
  if (v >= 50) return '普通';
  if (v >= 35) return '低め';
  return '要回復';
}
function scoreToColor(v: number, fallback: string): string {
  if (v >= 75) return '#4ADE80';
  if (v >= 55) return '#FACC15';
  if (v >= 35) return '#FFA94D';
  if (v > 0)   return '#FF6B6B';
  return fallback;
}
function formatSteps(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}
