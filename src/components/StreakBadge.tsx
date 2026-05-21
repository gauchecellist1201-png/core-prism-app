// ============================================================
// StreakBadge — 連続ログイン日数を「🔥 N日連続」で常時表示
// 節目 (3 / 7 / 30 / 100) では軽いお祝い演出
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Trophy, Share2 } from 'lucide-react';
import { useDailyStreak } from '../hooks/useDailyStreak';
import StreakShareModal from './StreakShareModal';
import StreakMilestoneCelebration from './StreakMilestoneCelebration';

const MILESTONES = [3, 7, 30, 100, 365];
const CELEBRATED_KEY = 'core_streak_celebrated_v1';

interface Props {
  /** 「Iris」用の色 (省略時はオレンジ) */
  accent?: string;
  size?: 'sm' | 'md';
  showBest?: boolean;
  /** Iris か Prism — シェア画像の見た目に効く */
  brand?: 'prism' | 'iris';
  /** シェア導線を表示するか (デフォルト true) */
  showShare?: boolean;
}

function loadCelebrated(): Set<number> {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY);
    if (!raw) return new Set();
    return new Set((JSON.parse(raw) as number[]).filter(n => typeof n === 'number'));
  } catch { return new Set(); }
}

function saveCelebrated(set: Set<number>) {
  try { localStorage.setItem(CELEBRATED_KEY, JSON.stringify(Array.from(set))); } catch { /* */ }
}

export default function StreakBadge({
  accent = '#F97316', size = 'md', showBest = true,
  brand = 'prism', showShare = true,
}: Props) {
  const { streak, best, freshOpen } = useDailyStreak();
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!freshOpen || streak <= 0) return;
    if (!MILESTONES.includes(streak)) return;
    const set = loadCelebrated();
    if (set.has(streak)) return;
    set.add(streak);
    saveCelebrated(set);
    setCelebrate(streak);
    const tid = window.setTimeout(() => setCelebrate(null), 5000);
    return () => window.clearTimeout(tid);
  }, [streak, freshOpen]);

  // streak が 0 は理論上来ない (touchStreak は最低 1 を返す) が、保険として
  if (streak <= 0) return null;

  // 初日 (streak === 1 && best === 1) は控えめに「ようこそ」を添える
  const isFirstDay = streak === 1 && best === 1;
  const isMd = size === 'md';
  const fontSize = isMd ? 12.5 : 11;
  const padding = isMd ? '5px 11px' : '4px 9px';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <motion.div
        initial={false}
        animate={celebrate ? { scale: [1, 1.18, 1], rotate: [0, -4, 4, 0] } : { scale: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
          color: accent,
          border: `1px solid ${accent}55`,
          borderRadius: 999,
          padding,
          fontSize, fontWeight: 800,
          letterSpacing: '0.02em',
          minHeight: 32,
        }}
        aria-label={`連続 ${streak} 日`}
      >
        <Flame size={isMd ? 13 : 11} fill={accent} strokeWidth={2.2} />
        <span>{isFirstDay ? '今日から続ける' : `${streak}日連続`}</span>
      </motion.div>

      {showBest && best > streak && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 10.5, fontWeight: 700,
          color: 'var(--fg-subtle)',
        }}>
          <Trophy size={10} /> 最高 {best} 日
        </span>
      )}

      {showShare && streak >= 2 && (
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="連続日数をシェア"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: `${accent}10`,
            border: `1px solid ${accent}33`,
            color: accent,
            borderRadius: 999,
            padding: isMd ? '6px 11px' : '5px 9px',
            fontSize: 10.5, fontWeight: 700,
            cursor: 'pointer',
            minHeight: 32,
          }}
        >
          <Share2 size={11} /> シェア
        </button>
      )}

      <AnimatePresence>
        {shareOpen && (
          <StreakShareModal
            streak={streak}
            best={best}
            brand={brand}
            accent={accent}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* 節目 (3/7/30/100/365 日) は 全画面 cinematic 祝祭 */}
      <AnimatePresence>
        {celebrate !== null && (
          <StreakMilestoneCelebration
            key={celebrate}
            streak={celebrate}
            brand={brand}
            accent={accent}
            onClose={() => setCelebrate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
