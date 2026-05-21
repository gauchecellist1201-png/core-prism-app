import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 各スタジオの一番上に出る「3 秒でわかる説明 + サンプル出力」ストリップ。
 * 初見の人が「この画面で何ができるか / まず何を押すか / どんな結果になるか」を
 * 触らずに理解できるようにする。一度 ✕ を押すと、その画面では二度と出ない。
 */
export function StudioIntro({
  id,
  accent,
  emoji,
  what,
  tryThis,
  example,
  samplePreview,
  sampleLabel = 'こんなのが出ます',
}: {
  id: string;
  accent: string;
  emoji: string;
  what: string;
  tryThis: string;
  example: string;
  samplePreview?: ReactNode;
  sampleLabel?: string;
}) {
  const storageKey = `cp-studio-intro-dismissed-${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* localStorage 不可でも閉じる */
    }
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            background: `linear-gradient(135deg, ${accent}18, ${accent}06 60%)`,
            border: `1px solid ${accent}40`,
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 14,
            overflow: 'hidden',
          }}
        >
          <div
            className="cp-row-between"
            style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}
          >
            <div
              className="cp-row"
              style={{ alignItems: 'flex-start', gap: 10, minWidth: 0, flex: '1 1 240px' }}
            >
              <span style={{ fontSize: '1.35rem', lineHeight: 1.2, flexShrink: 0 }}>{emoji}</span>
              <div className="cp-stack-sm" style={{ minWidth: 0 }}>
                <p className="cp-h3" style={{ lineHeight: 1.35 }}>{what}</p>
                <p className="cp-meta">
                  <span style={{ color: accent, fontWeight: 700 }}>まずは</span> {tryThis}
                </p>
                <p className="cp-tiny" style={{ opacity: 0.85 }}>例: {example}</p>
              </div>
            </div>

            {samplePreview && (
              <div
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  minWidth: 110,
                }}
              >
                <span
                  className="cp-tiny"
                  style={{
                    color: accent,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontSize: '0.65rem',
                  }}
                >
                  ▼ {sampleLabel}
                </span>
                <div
                  style={{
                    background: 'var(--surface-3)',
                    border: `1px dashed ${accent}55`,
                    borderRadius: 10,
                    padding: 6,
                    minWidth: 120,
                    maxWidth: 200,
                  }}
                  aria-label={`サンプル出力: ${sampleLabel}`}
                >
                  {samplePreview}
                </div>
              </div>
            )}

            <button
              onClick={dismiss}
              className="cp-btn cp-btn-ghost cp-btn-sm"
              style={{ flexShrink: 0 }}
              title="この説明を閉じる"
              aria-label="この説明を閉じる"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
