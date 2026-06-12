// ============================================================
// AILoadingState — AI が動いているときの「動いてる感」を統一する共通 UI
//
// なぜ作るか:
//  ボタンが「解析中…」だけだと、ユーザーは「本当に動いているのか?固まっただけでは?」
//  と不安になり、すぐ閉じる。Linear / ChatGPT / Granola は全部、
//   - スケルトン (内容の輪郭)
//   - 進捗テキスト (今何をしているか)
//   - 中断ボタン (ユーザーが諦めない為のエスケープ)
//  をきちんと出している。これを 1 つに集約して全 Studio に展開する。
//
// 使い方:
//   <AILoadingState
//     active={isAnalyzing}
//     label="議事録を作っています"
//     stages={['発言を読み込み中', '要点を抽出', '決定事項を整理', '議事録を整形']}
//     onAbort={() => abortRef.current?.abort()}
//     brand="prism"
//   />
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2, X, Sparkles } from 'lucide-react';

interface Props {
  /** ローディング表示するかどうか */
  active: boolean;
  /** メインラベル — 「議事録を作っています」「DM 下書き中」など */
  label?: string;
  /** 進捗テキストの段階 — 一定間隔で切り替わる (順に表示してリピート) */
  stages?: string[];
  /** 中断コールバック — undefined なら中断ボタン非表示 */
  onAbort?: () => void;
  /** ブランドカラー (prism=紫, iris=ピンク) */
  brand?: 'prism' | 'iris';
  /** スケルトン行数 (default 4) */
  skeletonLines?: number;
  /** 補助メッセージ (例: 「Claude が動いてます」) */
  hint?: string;
}

const STAGE_INTERVAL_MS = 2400;
const ABORT_REVEAL_AFTER_MS = 3500;

export default function AILoadingState({
  active,
  label = 'AI が考えています',
  stages,
  onAbort,
  brand = 'prism',
  skeletonLines = 4,
  hint,
}: Props) {
  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';
  const [stageIdx, setStageIdx] = useState(0);
  const [showAbort, setShowAbort] = useState(false);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setStageIdx(0);
      setShowAbort(false);
      return;
    }
    startRef.current = Date.now();
    const stageTimer = stages && stages.length > 1
      ? window.setInterval(() => setStageIdx(i => (i + 1) % stages.length), STAGE_INTERVAL_MS)
      : null;
    const abortTimer = window.setTimeout(() => setShowAbort(true), ABORT_REVEAL_AFTER_MS);
    return () => {
      if (stageTimer) window.clearInterval(stageTimer);
      window.clearTimeout(abortTimer);
    };
  }, [active, stages]);

  if (!active) return null;
  const stageText = stages && stages.length > 0 ? stages[stageIdx] : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={{
          padding: '14px 16px',
          background: `linear-gradient(180deg, ${accent}08 0%, ${accent}03 100%)`,
          border: `1px solid ${accent}22`,
          borderRadius: 14,
          color: '#fff',
          marginTop: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 10,
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 14px ${accent}66`,
            flexShrink: 0,
          }}>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-flex' }}
            >
              <Loader2 size={14} color="#fff" />
            </motion.span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', letterSpacing: '0.01em' }}>
              {label}
              <span style={{ display: 'inline-block', marginLeft: 4 }}>
                <BlinkingDots />
              </span>
            </div>
            {stageText && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={stageIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.62)', marginTop: 2 }}
                >
                  {stageText}
                </motion.div>
              </AnimatePresence>
            )}
            {hint && !stageText && (
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {hint}
              </div>
            )}
          </div>
          {showAbort && onAbort && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              onClick={onAbort}
              aria-label="中断"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              title="中断する"
            >
              <X size={14} />
            </motion.button>
          )}
        </div>

        {/* スケルトン — 中身の輪郭が見えると待ち時間の体感が短くなる */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: skeletonLines }).map((_, i) => (
            <SkeletonLine key={i} index={i} accent={accent} />
          ))}
        </div>

        {/* 補助 hint — abort 出現前は柔らかい案内 */}
        {!showAbort && (
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            fontSize: 10.5, color: 'rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Sparkles size={11} color={accent} />
            AI が動いてます。長くて 30 秒くらい。
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function SkeletonLine({ index, accent }: { index: number; accent: string }) {
  // 1 行ごとに微妙に width を変えて自然に見せる
  const widths = ['92%', '74%', '88%', '60%', '80%'];
  const w = widths[index % widths.length];
  const reduce = useReducedMotion();

  // やわらかい土台の上を、明るい一筋の光が左から右へ横切る。
  // 行ごとに少しずつ遅らせることで、光が上から下へ流れ落ちて見える ＝
  // 「ただ点滅する」のではなく「生きている」高級な待ち時間になる。
  if (reduce) {
    return (
      <div style={{
        height: 10, width: w, borderRadius: 5,
        background: `${accent}22`,
      }} />
    );
  }

  return (
    <motion.div
      initial={{ backgroundPosition: '180% 0' }}
      animate={{ backgroundPosition: '-180% 0' }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        delay: index * 0.14,
        ease: [0.4, 0.0, 0.2, 1],
      }}
      style={{
        height: 10,
        width: w,
        borderRadius: 5,
        background: `linear-gradient(100deg, ${accent}14 28%, ${accent}4d 50%, ${accent}14 72%)`,
        backgroundSize: '220% 100%',
      }}
    />
  );
}

function BlinkingDots() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }}
        />
      ))}
    </span>
  );
}
