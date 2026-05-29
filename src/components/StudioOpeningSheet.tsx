// ============================================================
// StudioOpeningSheet — Studio (重い lazy モーダル) を開いた瞬間に出す
//   「もう立ち上がっています」スケルトン・シート。
//
// なぜ作るか:
//   28 個の Studio はすべて React.lazy で、Suspense の fallback が null だった。
//   タップしても本体 JS が落ちてくるまで画面に何も出ない = 「タップ効いた?固まった?」
//   という不安を生む (とくに初回 / 回線が細い時)。
//   そこで本物の Studio と同じ形 (暗幕 + シート + ヘッダー + 本文) のスケルトンを
//   即座にスッと立ち上げ、本体が降ってきたら自然に置き換える。
//   待ち時間ゼロでも「贅沢に開く」感触を作るのが狙い。
// ============================================================
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

interface Props {
  /** ブランドカラー (prism=紫, iris=ピンク) */
  brand?: 'prism' | 'iris';
  /** フッターの一言 */
  label?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const BODY_LINES = ['92%', '78%', '85%', '64%', '73%'];

export default function StudioOpeningSheet({ brand = 'prism', label = 'ひらいています' }: Props) {
  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';

  return (
    <div
      className="cp-modal-bg"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`${label}…`}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: 720, borderTop: `2px solid ${accent}55` }}
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.34, ease: EASE }}
      >
        {/* ヘッダー — 光るブランドチップ + タイトル骨格 + 閉じるボタンの幽霊 */}
        <div className="cp-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <motion.div
              aria-hidden
              animate={{ boxShadow: [`0 0 0 ${accent}00`, `0 0 22px ${accent}88`, `0 0 0 ${accent}00`] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-flex' }}
              >
                <Sparkles size={18} color="#fff" />
              </motion.span>
            </motion.div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0, flex: 1 }}>
              <div className="skeleton" style={{ height: 13, width: '46%', borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 9, width: '30%', borderRadius: 5, opacity: 0.7 }} />
            </div>
          </div>
          <div
            aria-hidden
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'var(--surface-3)', opacity: 0.5,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} style={{ opacity: 0.4 }} />
          </div>
        </div>

        {/* 本文スケルトン — 中身の輪郭が見えると待ち時間が短く感じる */}
        <div className="cp-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[0, 1].map(i => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14 }} />
            ))}
          </div>
          {BODY_LINES.map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 11, width: w, borderRadius: 6 }} />
          ))}
          <div className="skeleton" style={{ height: 46, borderRadius: 12, marginTop: 4 }} />
        </div>

        {/* フッター — やわらかい案内 */}
        <div
          style={{
            padding: '11px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
          }}
        >
          <motion.span
            aria-hidden
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-flex' }}
          >
            <Sparkles size={12} color={accent} />
          </motion.span>
          <span style={{ fontSize: 11.5, color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center' }}>
            {label}
            <BlinkingDots />
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function BlinkingDots() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4 }} aria-hidden>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: 'currentColor' }}
        />
      ))}
    </span>
  );
}
