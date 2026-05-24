// ============================================================
// StripeConnectHero — ダッシュボード上で「Stripe をつなぐと売上が見える」を
//                     一目で伝える、未連携時だけ出る目立つバナー
//
// オーナー指示 (2026-05-25 night #2):
//   1) 未連携時に「今日のブリーフ」直下に大きめ CTA カードを 1 枚
//   2) ボタンタップで連携センター (Stripe セクション) を開く
//   3) 連携完了の瞬間に自動で消える (useStripeRevenue().connected を購読)
//
// 「30 秒で完了」と「過去 12 ヶ月の売上が即グラフ化」を約束する文言で、
// ユーザーが躊躇なく次のアクションに進めるようにする。
// ============================================================
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, ShieldCheck, Sparkles, Clock } from 'lucide-react';
import { useStripeRevenue } from '../hooks/useStripeRevenue';

interface Props {
  onOpenIntegrations: () => void;
}

const STRIPE = '#635BFF';

export default function StripeConnectHero({ onOpenIntegrations }: Props) {
  const { connected } = useStripeRevenue();

  // 連携済みなら何も出さない (= 自動で消える)
  if (connected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'relative',
        borderRadius: 20,
        padding: '1.1rem 1.15rem',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, rgba(99,91,255,0.18), rgba(46,111,255,0.10) 50%, rgba(52,211,153,0.08))',
        border: '1px solid rgba(99,91,255,0.36)',
        boxShadow: '0 8px 28px rgba(99,91,255,0.18)',
      }}
    >
      {/* 装飾オーブ */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,91,255,0.45) 0%, transparent 70%)',
          filter: 'blur(36px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Stripe ロゴ */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            background: STRIPE,
            color: '#fff',
            fontWeight: 900,
            fontSize: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(99,91,255,0.5)',
          }}
        >
          S
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* ラベル */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9.5,
              letterSpacing: '0.22em',
              fontWeight: 800,
              color: '#A099FF',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            <Sparkles size={11} /> あと 30 秒で
          </div>

          {/* 見出し */}
          <h3
            style={{
              margin: 0,
              fontSize: 'clamp(1.05rem, 3.4vw, 1.25rem)',
              fontWeight: 900,
              lineHeight: 1.3,
              color: 'var(--fg)',
            }}
          >
            Stripe をつなぐと、毎月の売上が自動で見えます
          </h3>

          {/* 補足 */}
          <p
            style={{
              margin: '0.4rem 0 0',
              fontSize: 12,
              color: 'var(--fg-muted)',
              lineHeight: 1.6,
            }}
          >
            読み取り専用キーを 1 行 貼るだけ。
            過去 12 ヶ月の売上・経費・利益がそのままグラフになります。
          </p>

          {/* ベネフィット 3 つ */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 10,
            }}
          >
            <Chip icon={<Clock size={11} />} label="30 秒で完了" />
            <Chip icon={<BarChart3 size={11} />} label="12 ヶ月グラフ即表示" />
            <Chip icon={<ShieldCheck size={11} />} label="読み取り専用で安全" />
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={onOpenIntegrations}
            style={{
              marginTop: 12,
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '11px 16px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 900,
              color: '#fff',
              background: `linear-gradient(135deg, ${STRIPE}, #8E5CFF)`,
              boxShadow: '0 6px 18px rgba(99,91,255,0.42)',
            }}
          >
            つなぐ <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10.5,
        fontWeight: 700,
        color: 'var(--fg)',
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 999,
        padding: '4px 10px',
      }}
    >
      {icon}
      {label}
    </span>
  );
}
