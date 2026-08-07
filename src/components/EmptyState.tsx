import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { seedDemoData, setDemoActive } from '../lib/onboarding';
// 空っぽ画面のアイコンも、タイル・画面上部の説明とまったく同じ台帳から引く
// (lib/featureIcons.ts)。「まだ商談がありません」の握手マークと、
// QuickActions の商談タイルが必ず同じ絵・同じ色になる。
import { resolveFeatureIcon } from '../lib/featureIcons';
import { accentFaceBg, accentFaceInk } from '../lib/accentFace';

interface Props {
  /** 大きな emoji (no-cheap-emoji 移行中の後方互換)。iconKey があればそちら優先 */
  icon?: string;
  /** EMPTY_ICONS のキー (推奨)。これだけで関連機能と同じブランド・アイコンが付く */
  iconKey?: string;
  /** 1 行のタイトル「まだ ◯◯ がありません」 */
  title: string;
  /** 2-3 行の説明文 (やさしい日本語) */
  description: string;
  /** プライマリ CTA のラベル (例: 「最初の 1 件を作る」) */
  ctaLabel?: string;
  /** プライマリ CTA を押したときのハンドラ */
  onCta?: () => void;
  /** ペルソナアクセントカラー (gradient のベース) */
  accent?: string;
  /** デモシードのセカンダリ CTA を表示するか */
  showSample?: boolean;
  /** サンプルボタンのラベルを上書き */
  sampleLabel?: string;
  /** 視覚的サンプル (薄く blur した完成例イメージ) を埋め込む場合 */
  preview?: React.ReactNode;
  /** 最大幅を上書きしたい場合 */
  maxWidth?: number;
}

/**
 * Prism / Iris 共通の空状態 UI。
 * 「次に何をすればいいか」が必ず分かるように、CTA + デモシード動線をセットで提示する。
 */
export default function EmptyState({
  icon,
  iconKey,
  title,
  description,
  ctaLabel,
  onCta,
  accent = '#c9a96e',
  showSample = true,
  sampleLabel,
  preview,
  maxWidth = 420,
}: Props) {
  const registered = resolveFeatureIcon(iconKey);
  const ResolvedIcon: LucideIcon | undefined = registered?.Icon;
  // その機能の色。空っぽ画面は面積が広いので、地は淡く・線とアイコンで色を出す
  const iconColor = registered?.color || accent;

  const handleSample = () => {
    try {
      seedDemoData();
      setDemoActive(true);
    } catch {
      /* ignore quota */
    }
    window.location.reload();
  };

  return (
    <motion.div
      className="cp-empty-pro"
      style={{ maxWidth, margin: '0 auto' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {ResolvedIcon ? (
        <div
          className="cp-empty-pro-icon"
          aria-hidden
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, borderRadius: 18, margin: '0 auto',
            // タイル・画面上部の説明と同じ「濃い色の四角 + 白いアイコン」。
            // 明るいテーマでも暗いテーマでも必ず見える (文字コントラスト恒久ルール)
            background: `linear-gradient(135deg, ${iconColor}, ${iconColor}cc)`,
            boxShadow: `0 8px 20px ${iconColor}44, inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
        >
          <ResolvedIcon size={34} color="#fff" strokeWidth={1.9} />
        </div>
      ) : (
        <div className="cp-empty-pro-icon" aria-hidden>{icon}</div>
      )}
      <p className="cp-empty-pro-title">{title}</p>
      <p className="cp-empty-pro-desc">{description}</p>

      {preview && (
        <div className="cp-empty-pro-preview" aria-hidden>
          {preview}
        </div>
      )}

      <div className="cp-empty-pro-ctas">
        {ctaLabel && onCta && (
          <motion.button
            type="button"
            onClick={onCta}
            className="cp-empty-pro-cta-primary"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{ background: accentFaceBg(accent), color: accentFaceInk(accent) }}
          >
            {ctaLabel}
          </motion.button>
        )}
        {showSample && (
          <motion.button
            type="button"
            onClick={handleSample}
            className="cp-empty-pro-cta-secondary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              borderColor: `${accent}55`, color: accent,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Sparkles size={15} strokeWidth={2} aria-hidden />
            {sampleLabel || 'サンプルから始める'}
          </motion.button>
        )}
      </div>
      {showSample && (
        <p className="cp-empty-pro-hint">サンプルは CAFE TANAKA のデモ。あとで消せます</p>
      )}
    </motion.div>
  );
}
