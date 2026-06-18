// ============================================================
// IrisConnectFirst — Iris の「最初のステップ」= Instagram 連携
//
// オーナー指示 (2026-06-18):
//   「IRIS はインスタと連携するところから始まる。一番最初のステップとして、
//    インスタの連携を最初に行えるようにしてほしい。」
//
// 未連携のユーザーがダッシュボードを開く前に、まずこの画面で連携を促す。
// 連携できない事情のある人を閉じ込めない (離脱ゼロ) ため、控えめに「あとで」も用意。
// モバイル最優先 (safe-area / 100svh / タップ 44px 以上)。
// ============================================================
import { motion } from 'framer-motion';
import { BarChart3, Sparkles, Search, ArrowRight } from 'lucide-react';
import { IrisLogo } from '../components/Logo';
import InstagramGlyph from './InstagramGlyph';

interface Props {
  /** 「Instagram を連携する」= 連携モーダルを開く */
  onConnect: () => void;
  /** 「あとで連携する」= ゲートを閉じてダッシュボードへ */
  onSkip: () => void;
}

const BENEFITS: { Icon: typeof BarChart3; title: string; desc: string }[] = [
  { Icon: BarChart3, title: '伸びる時間とテーマがわかる', desc: 'あなたの投稿データから、保存される投稿の共通点を分析します' },
  { Icon: Search, title: '相性の良い案件が届く', desc: 'フォロワー層に合うブランド案件を、毎日 AI が探してきます' },
  { Icon: Sparkles, title: '世界観に合った原稿を自動で', desc: 'キャプション・サムネ・リール構成をあなた専用に作ります' },
];

export default function IrisConnectFirst({ onConnect, onSkip }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        minHeight: '100svh',
        background: 'radial-gradient(ellipse at 50% -10%, rgba(225,48,108,0.16) 0%, #fff 55%)',
        color: '#1F1A2E',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        overflowY: 'auto',
        padding: 'max(2rem, calc(env(safe-area-inset-top,0px) + 1.5rem)) 1.25rem calc(env(safe-area-inset-bottom,0px) + 1.5rem)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460, margin: 'auto 0', display: 'flex', flexDirection: 'column' }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}
        >
          <IrisLogo size={40} withWordmark />
        </motion.div>

        {/* Instagram グラデーションのオーブ + カメラ */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 200, delay: 0.1 }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}
        >
          <div style={{
            width: 88, height: 88, borderRadius: 26,
            background: 'linear-gradient(135deg, #833AB4 0%, #E1306C 50%, #F77737 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 18px 44px rgba(225,48,108,0.4)',
          }}>
            <InstagramGlyph size={42} color="#fff" strokeWidth={2.2} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{ textAlign: 'center', marginBottom: '1.5rem' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10.5, letterSpacing: '0.25em', fontWeight: 800, color: '#E1306C',
            marginBottom: 8,
          }}>
            <InstagramGlyph size={12} color="#E1306C" /> STEP 1 — まずはここから
          </div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.4, margin: '0 0 0.6rem' }}>
            Instagram をつなぐと、<br />Iris があなた専用になります
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#5A5562', lineHeight: 1.75, margin: 0 }}>
            連携は <strong style={{ color: '#1F1A2E' }}>30 秒</strong>。スクショ 1 枚でも始められます。
          </p>
        </motion.div>

        {/* できること 3 つ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.75rem' }}>
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + i * 0.08 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', borderRadius: 16,
                border: '1px solid rgba(225,48,108,0.14)',
                padding: '0.85rem 1rem',
                boxShadow: '0 6px 18px rgba(225,48,108,0.06)',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(225,48,108,0.12), rgba(247,119,55,0.10))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <b.Icon size={20} color="#E1306C" strokeWidth={2.3} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.4 }}>{b.title}</div>
                <div style={{ fontSize: 11.5, color: '#7A7585', lineHeight: 1.5, marginTop: 2 }}>{b.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          type="button"
          onClick={onConnect}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.5 }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: '100%', minHeight: 56,
            background: 'linear-gradient(135deg, #833AB4 0%, #E1306C 50%, #F77737 100%)',
            color: '#fff', border: 'none', borderRadius: 99,
            padding: '1rem 1.4rem', fontSize: 16, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 12px 30px rgba(225,48,108,0.42)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <InstagramGlyph size={19} color="#fff" /> Instagram を連携する <ArrowRight size={18} />
        </motion.button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            width: '100%', minHeight: 44,
            background: 'transparent', border: 'none',
            color: '#8A8593', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', marginTop: 14,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          あとで連携する（先に中を見てみる）
        </button>
      </div>
    </div>
  );
}
