import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Clock, RefreshCw } from 'lucide-react';
import { PrismLogo } from './Logo';

/**
 * AI が考えている数十秒を「不安な無音」ではなく
 * 「ちゃんと働いてくれている実感」に変えるための共通待ち時間 UI。
 */
type Props = {
  accent: string;
  /** 順に表示するメッセージ。実際の工程に沿わせると「進んでいる感」が出る */
  messages: string[];
  /** full: 結果欄まるごとの待機 / compact: カード内の小さな待機 */
  variant?: 'full' | 'compact';
  /** メッセージ下に固定で出す補足 (人格名やヒントなど) */
  subtitle?: string;
  /** 指定すると 90 秒を超えたとき「もう一度ためす」救済導線を出す */
  onRetry?: () => void;
};

/** これ以上待つと不安になるしきい値 (秒) */
const RESCUE_AFTER = 90;

export default function ThinkingIndicator({
  accent,
  messages,
  variant = 'full',
  subtitle,
  onRetry,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [secs, setSecs] = useState(0);
  const [rescueDismissed, setRescueDismissed] = useState(false);
  const startRef = useRef(Date.now());
  // OS の「視差効果を減らす / 動きを減らす」設定を尊重する。
  // CSS アニメは index.css で既に止まるが、framer-motion の JS アニメは別途ここで静める。
  const reduce = useReducedMotion();

  const showRescue = !!onRetry && secs >= RESCUE_AFTER && !rescueDismissed;

  // メッセージは 2.6 秒ごとに次へ。最後まで来たら最後の文で止める
  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => {
      setIdx((i) => Math.min(i + 1, messages.length - 1));
    }, 2600);
    return () => clearInterval(t);
  }, [messages.length]);

  // 経過秒数。「ほうっておかれていない」安心感のため
  useEffect(() => {
    const t = setInterval(() => {
      setSecs(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const orbSize = variant === 'full' ? 108 : 56;
  const markSize = variant === 'full' ? 64 : 34;

  return (
    <div
      style={{
        textAlign: 'center',
        padding: variant === 'full' ? '2.6rem 1.5rem' : '1.8rem 0',
      }}
    >
      {/* 呼吸するオーブ — 三重の波紋 + 周囲のパーティクル + 光線で「生きて考えている」感 */}
      <div
        style={{
          position: 'relative',
          width: orbSize * 2.4,
          height: orbSize * 2.4,
          margin: `0 auto ${variant === 'full' ? '1.5rem' : '1rem'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 垂直の光線 — 上下に光が走る */}
        {variant === 'full' && !reduce && (
          <motion.div
            aria-hidden
            animate={{ scaleY: [0.4, 1.3, 0.4], opacity: [0.15, 0.6, 0.15] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              left: '50%', top: 0, bottom: 0,
              width: 2, transform: 'translateX(-50%)',
              background: `linear-gradient(180deg, transparent 0%, ${accent} 50%, transparent 100%)`,
              filter: `blur(2px) drop-shadow(0 0 8px ${accent})`,
              transformOrigin: 'center',
            }}
          />
        )}

        {/* 周囲を漂うパーティクル (8 粒) — 生きて呼吸している雰囲気 */}
        {!reduce && [0, 1, 2, 3, 4, 5, 6, 7].map((p) => {
          const angle = (p / 8) * Math.PI * 2;
          const r = orbSize * 1.05;
          const cx = Math.cos(angle) * r;
          const cy = Math.sin(angle) * r;
          return (
            <motion.div
              key={`p${p}`}
              aria-hidden
              animate={{
                x: [cx, cx * 1.15, cx],
                y: [cy, cy * 1.15, cy],
                opacity: [0.3, 0.95, 0.3],
                scale: [0.6, 1.15, 0.6],
              }}
              transition={{
                duration: 3.2 + (p % 3) * 0.4,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: p * 0.18,
              }}
              style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: variant === 'full' ? 5 : 3,
                height: variant === 'full' ? 5 : 3,
                borderRadius: '50%',
                background: accent,
                boxShadow: `0 0 8px ${accent}, 0 0 16px ${accent}88`,
              }}
            />
          );
        })}

        {/* 三重波紋 */}
        <div style={{ position: 'relative', width: orbSize, height: orbSize }}>
          {!reduce && [0, 1, 2].map((ring) => (
            <motion.div
              key={ring}
              animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeOut',
                delay: ring * 0.55,
              }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `1.5px solid ${accent}`,
              }}
            />
          ))}
          {/* 中心のオーブ — ガラス質のコアの中で Prism マークが静かに回る */}
          <motion.div
            animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `radial-gradient(circle at 34% 28%, ${accent}33 0%, ${accent}1f 46%, transparent 72%)`,
              border: `1px solid ${accent}44`,
              boxShadow: `0 0 30px ${accent}55, inset 0 0 22px ${accent}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* 回転する Prism マーク (CORE 公式の多面体プリズム) */}
            <motion.div
              animate={reduce ? undefined : { rotate: [0, 360] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
              style={{
                display: 'inline-flex',
                filter: `drop-shadow(0 0 10px ${accent}aa)`,
              }}
            >
              <PrismLogo size={markSize} withWordmark={false} />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* 工程メッセージ — すっと入れ替わる */}
      <div style={{ minHeight: variant === 'full' ? 28 : 22, marginBottom: 6 }}>
        {/* 退場アニメ待ち禁止(rAF停止環境で文言が固まる/二重表示になる)・キー切替入場のみ */}
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            style={{
              fontSize: variant === 'full' ? '1.05rem' : '0.9rem',
              fontWeight: 700,
              color: 'var(--fg)',
            }}
          >
            {messages[idx]}
          </motion.p>
      </div>

      {subtitle && (
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--fg-muted)',
            lineHeight: 1.8,
            marginBottom: variant === 'full' ? 18 : 10,
          }}
        >
          {subtitle}
        </p>
      )}

      {/* 経過秒数 — そっと、責めない大きさで */}
      <p style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', fontVariantNumeric: 'tabular-nums' }}>
        {secs} 秒経過{secs >= 45 && !showRescue ? ' — もう少しです' : ''}
      </p>

      {/* 90 秒超の救済導線 — 責めず、選べる形で */}
      <AnimatePresence>
        {showRescue && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}
            style={{
              maxWidth: 340,
              margin: '1.1rem auto 0',
              padding: '0.9rem 1rem',
              borderRadius: 12,
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Clock size={15} style={{ color: accent }} aria-hidden />
              思ったより時間がかかっています
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', lineHeight: 1.7, marginTop: 4 }}>
              通信が混み合っているのかもしれません。
              <br />
              もう一度ためすか、このまま待つか選べます。
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => onRetry?.()}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: 10,
                  background: accent,
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <RefreshCw size={14} aria-hidden />
                もう一度ためす
              </button>
              <button
                onClick={() => setRescueDismissed(true)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: 10,
                  background: 'var(--surface-3)',
                  color: 'var(--fg)',
                  border: '1px solid var(--border)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                このまま待つ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* full のときだけ「文章が組み上がっていく」骨組みを見せる */}
      {variant === 'full' && (
        <div
          style={{
            display: 'grid',
            gap: 9,
            maxWidth: 320,
            margin: '1.6rem auto 0',
          }}
        >
          {[100, 88, 94, 70].map((w, i) => (
            <div
              key={i}
              className="cp-skeleton-line"
              style={{
                height: 11,
                width: `${w}%`,
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
