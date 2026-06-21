// ============================================================
// CORE Iris — 「3 秒でわかる」イントロ・ストリップ
//
// オーナー指示 (2026-05-15): オーナー本人ですら使い方が分からない = 完全な失敗。
//
// Prism 側の StudioIntro と同じ役割を Iris のトーン (光・ピンク・セリフ) で実装。
// 各タブの一番上に出て、初見の人が触らずに
//   ・この画面で何ができるか (what)
//   ・まず何を押せばいいか (tryThis)
//   ・どんな結果になるか (example)
// を 3 秒で理解できるようにする。一度 ✕ を押すと、その画面では二度と出ない。
// ============================================================
import { useState, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

export default function IrisIntro({
  id,
  bg,
  icon: Icon,
  what,
  tryThis,
  example,
}: {
  /** タブごとに一意。閉じた状態を localStorage に覚える */
  id: string;
  bg: IrisBackgroundDef;
  /** Lucide ライン・アイコン */
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** この画面で何ができるか (1 行) */
  what: string;
  /** まず何を押せばいいか */
  tryThis: string;
  /** どんな結果になるか (具体例) */
  example: string;
}) {
  const accent = bg.accent;
  const storageKey = `iris-intro-dismissed-${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const [closeHover, setCloseHover] = useState(false);

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
            background: `linear-gradient(135deg, ${accent}14, ${accent}05 60%)`,
            border: `1px solid ${accent}33`,
            borderRadius: 16,
            padding: '13px 15px',
            marginBottom: 16,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 38, height: 38, borderRadius: 12,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: `${accent}1F`, border: `1px solid ${accent}3A`,
              }}
            >
              <Icon size={20} color={accent} strokeWidth={2.2} />
            </span>

            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                margin: 0,
                fontFamily: IRIS_FONTS.body,
                fontSize: '0.95rem', fontWeight: 800,
                color: bg.ink, lineHeight: 1.4,
              }}>
                {what}
              </p>
              <p style={{
                margin: '3px 0 0',
                fontSize: '0.8rem', color: bg.inkSoft, lineHeight: 1.5,
              }}>
                <span style={{ color: accent, fontWeight: 800 }}>まずは</span> {tryThis}
              </p>
              <p style={{
                margin: '2px 0 0',
                fontSize: '0.74rem', color: bg.inkSoft, opacity: 0.85, lineHeight: 1.5,
              }}>
                例: {example}
              </p>
            </div>

            <button
              onClick={dismiss}
              onPointerEnter={() => setCloseHover(true)}
              onPointerLeave={() => setCloseHover(false)}
              title="この説明を閉じる"
              aria-label="この説明を閉じる"
              style={{
                flexShrink: 0,
                width: 28, height: 28, borderRadius: 9,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: closeHover ? `${accent}1A` : 'transparent',
                border: `1px solid ${closeHover ? `${accent}55` : bg.cardBorder}`,
                color: closeHover ? accent : bg.inkSoft, cursor: 'pointer',
                // hover の色変化に加え、全ボタン共通の「押すと沈む」感触 (transform/filter) も残す
                transition:
                  'background 0.15s ease, border-color 0.15s ease, color 0.15s ease,' +
                  ' transform var(--cp-duration-base) var(--cp-ease-springy),' +
                  ' filter var(--cp-duration-base) var(--cp-ease-springy)',
              }}
            >
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
