import { motion } from 'framer-motion';

/**
 * 灰色の「読み込み中…」を「ちゃんと考えてる気配」に変えるための小さな共通 UI。
 * ボタン内 (dots) と パネル内 (orbit) の 2 形態。
 */

type DotsProps = {
  /** ボタン内で使う前提。色はボタン文字色に同調 */
  color?: string;
  /** 表示する文字 (例: '考えてる' '送ってる') */
  label?: string;
};

/** ボタン内: 「●●●」が呼吸する。文字幅はタブラ数字で固定 */
export function LoaderDots({ color = 'currentColor', label = '考えてる' }: DotsProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
            transition={{
              duration: 1.05,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.18,
            }}
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
            }}
          />
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}

type BlockProps = {
  /** 強調色 (アクセント) */
  accent?: string;
  /** ふんわり出す文字 */
  message?: string;
  /** 余白サイズ */
  padding?: string;
};

/**
 * パネル内: 周回するアクセント点 + シマーする線 3 本。
 * 「ほうっておかれていない」気配を、灰色一行よりほんの少しだけ強く出す。
 */
export function LoaderBlock({
  accent = '#A78BFA',
  message = '読み込んでます',
  padding = '2rem 1rem',
}: BlockProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        textAlign: 'center',
        padding,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* 周回するアクセント点 */}
      <div
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 中心の小さな円 — 呼吸 */}
        <motion.div
          aria-hidden
          animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 14px ${accent}88`,
          }}
        />
        {/* 外周を回る点 */}
        <motion.div
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
            }}
          />
        </motion.div>
      </div>

      <p
        style={{
          fontSize: '0.86rem',
          fontWeight: 600,
          color: 'var(--fg, #2a2731)',
          margin: 0,
        }}
      >
        {message}
      </p>

      {/* 細い 3 本のシマー線で「組み立て中」感をうっすら */}
      <div style={{ display: 'grid', gap: 6, width: '60%', maxWidth: 220, marginTop: 4 }}>
        {[100, 78, 88].map((w, i) => (
          <div
            key={i}
            className="cp-skeleton-line"
            style={{ height: 7, width: `${w}%`, animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}
