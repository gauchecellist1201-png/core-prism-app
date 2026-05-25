import { motion } from 'framer-motion';
import { seedDemoData, setDemoActive } from '../lib/onboarding';

interface Props {
  /** 大きな emoji または icon (60-80px サイズで表示) */
  icon: string;
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
      <div className="cp-empty-pro-icon" aria-hidden>{icon}</div>
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
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
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
            style={{ borderColor: `${accent}55`, color: accent }}
          >
            {sampleLabel || '✨ サンプルから始める'}
          </motion.button>
        )}
      </div>
      {showSample && (
        <p className="cp-empty-pro-hint">サンプルは CAFE TANAKA のデモ。あとで消せます</p>
      )}
    </motion.div>
  );
}
