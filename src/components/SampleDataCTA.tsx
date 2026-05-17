import { motion } from 'framer-motion';
import { seedDemoData, setDemoActive } from '../lib/onboarding';

interface Props {
  /** ボタン文言 (省略時は標準コピー) */
  label?: string;
  /** アクセントカラー (ペルソナ色など) */
  accent?: string;
  /** ボタン下の補足文 */
  hint?: string;
}

/**
 * 空状態に置く「お試しデータで触ってみる」ボタン。
 * 押すと実物品質のサンプル (カフェ経営者・田中健一) を localStorage に投入し、
 * リロードして全機能をすぐ体験できる状態にする。
 */
export default function SampleDataCTA({
  label = '✨ お試しデータで触ってみる',
  accent = '#c9a96e',
  hint = '実際の使い心地をそのまま体験できます (あとで消せます)',
}: Props) {
  const handleClick = () => {
    try {
      seedDemoData();
      setDemoActive(true);
    } catch {
      /* localStorage quota — リロードだけ進める */
    }
    window.location.reload();
  };

  return (
    <div className="cp-sample-cta-wrap">
      <motion.button
        type="button"
        onClick={handleClick}
        className="cp-sample-cta"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
      >
        {label}
      </motion.button>
      {hint && <p className="cp-sample-cta-hint">{hint}</p>}
    </div>
  );
}
