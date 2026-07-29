import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
// アイコンと色は 1 か所の台帳から引く。
// QuickActions のタイルとまったく同じ絵・同じ色になり、
// 「タイルで押した機能」と「開いた画面の上」が一目でつながる。
import { resolveFeatureIcon } from '../lib/featureIcons';

/**
 * 各スタジオの一番上に出る「3 秒でわかる説明 + サンプル出力」ストリップ。
 * 初見の人が「この画面で何ができるか / まず何を押すか / どんな結果になるか」を
 * 触らずに理解できるようにする。一度 ✕ を押すと、その画面では二度と出ない。
 */
export function StudioIntro({
  id,
  accent,
  emoji,
  icon: Icon,
  iconKey,
  what,
  tryThis,
  example,
  samplePreview,
  sampleLabel = 'こんなのが出ます',
}: {
  id: string;
  accent: string;
  /** 旧来の絵文字 (no-cheap-emoji 移行中の後方互換)。icon / iconKey があればそちら優先 */
  emoji?: string;
  /** Lucide ライン・アイコン (直接指定)。指定時は iconKey / emoji より優先 */
  icon?: LucideIcon;
  /** STUDIO_ICONS のキー (推奨)。これだけで関連機能と同じブランド・アイコンが付く */
  iconKey?: string;
  what: string;
  tryThis: string;
  example: string;
  samplePreview?: ReactNode;
  sampleLabel?: string;
}) {
  // 台帳に無い id でも取りこぼさないよう、画面の id 自体でももう一度引く
  // (以前は briefing / calendar / deals / folder / decision でアイコンが消えていた)
  const registered = resolveFeatureIcon(iconKey) || resolveFeatureIcon(id);
  const ResolvedIcon: LucideIcon | undefined = Icon || registered?.Icon;
  // アイコンの色は「その機能の色」。タイルと同じ色で出す (無ければペルソナ色)
  const iconColor = registered?.color || accent;
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
              {ResolvedIcon ? (
                <span
                  style={{
                    flexShrink: 0,
                    width: 36, height: 36, borderRadius: 10,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    // QuickActions のタイルと同じ「濃い色の四角 + 白いアイコン」。
                    // 明るいテーマでも暗いテーマでも必ず読める (文字コントラスト恒久ルール)
                    background: `linear-gradient(135deg, ${iconColor}, ${iconColor}cc)`,
                    boxShadow: `0 5px 12px ${iconColor}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
                  }}
                >
                  <ResolvedIcon size={20} color="#fff" strokeWidth={2.2} />
                </span>
              ) : (
                <span style={{ fontSize: '1.35rem', lineHeight: 1.2, flexShrink: 0 }}>{emoji}</span>
              )}
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
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
