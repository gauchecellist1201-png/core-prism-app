import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';

interface Props {
  persona: Persona;
  knowledgeCount: number;
  taskCount: { open: number; done: number };
  proposalCount: number;
}

const BANDS = [
  { id: 'logic',    label: '論理', color: '#5BA8FF', desc: '分析・データ・戦略' },
  { id: 'empathy',  label: '共感', color: '#FF6FB5', desc: '対話・ケア・チーム' },
  { id: 'creative', label: '創造', color: '#B57CFF', desc: '芸術・世界観・想像' },
  { id: 'action',   label: '実行', color: '#FFA94D', desc: '推進・スピード・行動' },
  { id: 'ethics',   label: '倫理', color: '#FACC15', desc: '判断・責任・公正' },
];

// 人格説明から5波長スコアを推定 (0-100)
function inferBands(persona: Persona): Record<string, number> {
  const desc = (persona.name + ' ' + persona.description + ' ' + persona.subtitle).toLowerCase();
  const score = {
    logic:    20 + countMatches(desc, ['データ', '分析', '戦略', '財務', '数字', '科学', '医療', 'コード', 'アーキテクチャ', 'cto', '投資']) * 12,
    empathy:  20 + countMatches(desc, ['共感', '患者', 'カウンセリング', 'コミュニケーション', '対話', 'チーム', 'ケア', '家族']) * 12,
    creative: 20 + countMatches(desc, ['クリエイティブ', 'デザイン', '音楽', 'アート', '世界観', 'ストーリー', '美', '想像', '創造']) * 12,
    action:   20 + countMatches(desc, ['実行', 'スピード', '起業家', 'coo', '営業', '実践', '行動', 'リーダー', '仮説検証']) * 12,
    ethics:   20 + countMatches(desc, ['倫理', '法務', 'コンプライアンス', '責任', '判断', '誠実', '公正', '医療']) * 12,
  };
  for (const k of Object.keys(score)) (score as any)[k] = Math.min(95, Math.max(15, (score as any)[k]));
  return score;
}

function countMatches(haystack: string, needles: string[]): number {
  return needles.filter(n => haystack.includes(n)).length;
}

// 連続フローのための時間進行 (requestAnimationFrame)
function useAnimatedTime(active = true): number {
  const [t, setT] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      ref.current = (performance.now() - start) / 1000;
      setT(ref.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}

// カウントアップ用フック (数値が変わったら短時間でアニメーション)
function useCountUp(target: number, durationMs = 700): number {
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (target === val) return;
    const from = val;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return val;
}

export default function PrismFlow({ persona, knowledgeCount, taskCount, proposalCount }: Props) {
  const bands = useMemo(() => inferBands(persona), [persona]);
  const t = useAnimatedTime(true);

  const stats = [
    { label: '資料',         value: knowledgeCount,    icon: '📄', color: BANDS[0].color },
    { label: '未完了タスク', value: taskCount.open,    icon: '⚡', color: BANDS[3].color },
    { label: '完了',         value: taskCount.done,    icon: '✓',  color: BANDS[4].color },
    { label: '提案',         value: proposalCount,     icon: '💡', color: BANDS[2].color },
  ];

  return (
    <motion.div
      className="rounded-2xl overflow-hidden relative"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      {/* 背景のうっすら光るオーロラ */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-12 -left-12 w-48 h-48 rounded-full"
          style={{ background: persona.accentColor, filter: 'blur(60px)', opacity: 0.18 }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full"
          style={{ background: BANDS[1].color, filter: 'blur(60px)', opacity: 0.13 }}
          animate={{ x: [0, -20, 0], y: [0, -15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative px-3 pt-3 pb-2 flex items-center justify-between">
        <div>
          <p className="text-fg text-sm font-medium leading-tight">🌈 認知プロファイル</p>
          <p className="text-fg-muted text-[10px] mt-0.5">名前 + 説明文から AI が推定した「思考の傾向」</p>
        </div>
        <span className="text-fg-muted text-xs">{persona.name} の5波長</span>
      </div>

      {/* 5波長ウェーブ — 連続してフローする */}
      <div className="relative px-3 pb-3">
        <svg viewBox="0 0 400 100" className="w-full h-24" preserveAspectRatio="none">
          <defs>
            {BANDS.map(b => (
              <linearGradient key={b.id} id={`grad-${b.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={b.color} stopOpacity="0.05" />
                <stop offset="50%"  stopColor={b.color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={b.color} stopOpacity="0.05" />
              </linearGradient>
            ))}
            {/* ぼかしグロー */}
            <filter id="prism-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 中央の薄いガイドライン */}
          <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />

          {BANDS.map((b, i) => {
            const score = bands[b.id];
            const amp = (score / 100) * 32 + 4;
            const yMid = 50;
            const speed = 0.6 + i * 0.18;             // 各波で速度が違う
            const phase = (t * speed) + i * 0.7;
            const freq = 1.6 + i * 0.22;
            const path = buildSineWavePath(0, 400, yMid, amp, freq, phase);
            // 影として薄い太線も重ねる (グロー感)
            const glowPath = buildSineWavePath(0, 400, yMid, amp, freq, phase);
            return (
              <g key={b.id} filter="url(#prism-glow)">
                {/* 太い薄ストロークでグロー */}
                <path d={glowPath} fill="none" stroke={b.color} strokeWidth={4} strokeOpacity={0.18} />
                {/* メインの線 (グラデでフェード) */}
                <path d={path} fill="none" stroke={`url(#grad-${b.id})`} strokeWidth={1.8} />
              </g>
            );
          })}

          {/* 流れる粒子 (上に小さなドットが波に乗る) */}
          {BANDS.map((b, i) => {
            const score = bands[b.id];
            const amp = (score / 100) * 32 + 4;
            const speed = 0.6 + i * 0.18;
            const phase = (t * speed) + i * 0.7;
            const freq = 1.6 + i * 0.22;
            // 粒子の x 位置を時間で動かす
            const px = ((t * 50 + i * 80) % 400);
            const py = sineY(px, 400, 50, amp, freq, phase);
            return (
              <circle key={`p-${b.id}`} cx={px} cy={py} r={2} fill={b.color} opacity={0.85}>
                <animate attributeName="opacity" values="0.85;0.3;0.85" dur="2.4s" repeatCount="indefinite" />
              </circle>
            );
          })}
        </svg>

        {/* 5波長ラベル + 進捗バー (波と同期して脈動) */}
        <div className="grid grid-cols-5 gap-1 mt-1.5">
          {BANDS.map((b, i) => {
            const score = Math.round(bands[b.id]);
            const pulse = 0.5 + 0.5 * Math.sin(t * (0.6 + i * 0.18) + i * 0.7); // 0..1
            return (
              <div key={b.id} className="text-center" title={b.desc}>
                <div className="h-1 rounded-full mb-1 overflow-hidden" style={{ background: 'var(--border)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: b.color,
                      boxShadow: `0 0 ${4 + pulse * 8}px ${b.color}`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.9, delay: 0.2 }}
                  />
                </div>
                <p className="text-[10px] font-medium" style={{ color: b.color }}>{b.label}</p>
                <p className="text-[10px] text-fg-muted">{score}</p>
              </div>
            );
          })}
        </div>

        {/* 凡例 (ホバーで説明) */}
        <p className="text-[10px] text-fg-subtle text-center mt-1.5 leading-tight">
          各波長にカーソルを乗せると意味が表示されます · 数値は人格説明から AI 推定
        </p>
      </div>

      {/* 状態統計 — 数値はカウントアップ */}
      <div className="relative grid grid-cols-4 gap-1 px-3 pb-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        {stats.map((s, i) => (
          <StatTile key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} delay={0.3 + i * 0.05} />
        ))}
      </div>
    </motion.div>
  );
}

function StatTile({ icon, label, value, color, delay }: { icon: string; label: string; value: number; color: string; delay: number }) {
  const animated = useCountUp(value);
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-2 rounded-lg relative overflow-hidden"
      style={{ background: 'var(--surface)' }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={{ y: -2 }}
    >
      {/* 値が変化したときに走る薄いグロー */}
      <motion.div
        key={value}
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${color}33 0%, transparent 60%)` }}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.9 }}
      />
      <span className="text-base relative">{icon}</span>
      <span className="text-fg text-base font-medium leading-tight relative">{animated}</span>
      <span className="text-fg-muted text-[10px] relative">{label}</span>
    </motion.div>
  );
}

function buildSineWavePath(x0: number, x1: number, y: number, amp: number, freq: number, phase: number): string {
  const steps = 80;
  const dx = (x1 - x0) / steps;
  let path = `M ${x0} ${y}`;
  for (let i = 1; i <= steps; i++) {
    const x = x0 + i * dx;
    const yy = sineY(x, x1, y, amp, freq, phase);
    path += ` L ${x.toFixed(1)} ${yy.toFixed(1)}`;
  }
  return path;
}

function sineY(x: number, width: number, yMid: number, amp: number, freq: number, phase: number): number {
  const t = (x / width) * Math.PI * 2 * freq + phase;
  return yMid + Math.sin(t) * amp;
}
