// ============================================================
// IrisCrystalHero — ホーム最上部のヒーロー
//
// 「花 → 見出し → 巨大入力 → 3つの入口」が 375px の 1 画面に収まる構成。
//   - 背景 = IrisCrystalBloom (three.js のガラスの花 / ブランドロゴ再現)
//     three.js は重いので React.lazy で遅延読込。読込中・WebGL 不可・
//     チャンク取得失敗 (弱い電波) のどの場合も、下層の CSS グラデ +
//     ロゴ風 SVG の花が静かに表示され続ける (無限スピナーなし)
//   - 前面下部 = セリフ体大文字「IRIS」+ 一言 (白・text-shadow でコントラスト確保)
//   - children = IrisThoughtDropSection (巨大入力) をそのまま受け入れる
//   - 入力の下 = ガラスチップ 3 つ (予約投稿 / 企画・台本 / 分析)
// ============================================================
import React from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Clapperboard, TrendingUp } from 'lucide-react';
import { IRIS_FONTS, type IrisBackgroundDef } from './irisStyle';

const IrisCrystalBloom = React.lazy(() => import('./IrisCrystalBloom'));

/** ホームから飛べる 3 つの入口 (IrisDashboard の Tab 名に一致させる) */
export type IrisHeroTab = 'schedule' | 'script' | 'strategy';

interface Props {
  bg: IrisBackgroundDef;
  /** タブ切替 (IrisDashboard の setTab へ橋渡し) */
  onNavigate?: (tab: IrisHeroTab) => void;
  /** 巨大入力 (IrisThoughtDropSection) をそのまま挟む */
  children?: React.ReactNode;
}

// three.js チャンクの取得失敗 (弱い電波など) でもホーム全体を巻き込まない
class BloomBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

// ─── フォールバック: ロゴ風 SVG の花 (canvas が乗れば隠れる) ───
function FallbackFlower() {
  const outer = Array.from({ length: 6 }, (_, i) => i * 60);
  const inner = Array.from({ length: 6 }, (_, i) => i * 60 + 30);
  return (
    <svg
      viewBox="-140 -140 280 280"
      aria-hidden
      style={{ width: 'min(58%, 290px)', height: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id="irisHeroPetalOuter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7AA8" />
          <stop offset="55%" stopColor="#E1306C" />
          <stop offset="100%" stopColor="#8E1030" />
        </linearGradient>
        <linearGradient id="irisHeroPetalInner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFDC80" />
          <stop offset="60%" stopColor="#FCB045" />
          <stop offset="100%" stopColor="#F77737" />
        </linearGradient>
        <radialGradient id="irisHeroCore">
          <stop offset="0%" stopColor="#FFE9CF" />
          <stop offset="55%" stopColor="#FFAE78" />
          <stop offset="100%" stopColor="#E1306C" />
        </radialGradient>
      </defs>
      {outer.map(a => (
        <path
          key={`o${a}`}
          d="M0 -112 C 16 -82, 17 -34, 0 -6 C -17 -34, -16 -82, 0 -112 Z"
          fill="url(#irisHeroPetalOuter)"
          opacity={0.92}
          transform={`rotate(${a})`}
        />
      ))}
      {inner.map(a => (
        <path
          key={`i${a}`}
          d="M0 -64 C 11 -47, 12 -21, 0 -4 C -12 -21, -11 -47, 0 -64 Z"
          fill="url(#irisHeroPetalInner)"
          opacity={0.95}
          transform={`rotate(${a})`}
        />
      ))}
      <circle r="15" fill="url(#irisHeroCore)" />
    </svg>
  );
}

// ─── 3 つのガラスチップ (多機能への入口) ───
const CHIPS: Array<{ tab: IrisHeroTab; label: string; Icon: typeof CalendarClock; grad: string }> = [
  { tab: 'schedule', label: '予約投稿',   Icon: CalendarClock, grad: 'linear-gradient(135deg, #E1306C 0%, #833AB4 100%)' },
  { tab: 'script',   label: '企画・台本', Icon: Clapperboard,  grad: 'linear-gradient(135deg, #833AB4 0%, #E1306C 100%)' },
  { tab: 'strategy', label: '分析',       Icon: TrendingUp,    grad: 'linear-gradient(135deg, #F77737 0%, #E1306C 100%)' },
];

export default function IrisCrystalHero({ bg, onNavigate, children }: Props) {
  return (
    <section aria-label="Iris ホーム ヒーロー" style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>
      {/* ── 花のステージ (100svh にはしない — 下へスクロールで続く) ── */}
      <div style={{
        position: 'relative',
        height: 'min(54svh, 560px)',
        minHeight: 340,
        borderRadius: 28,
        overflow: 'hidden',
        // フォールバック兼、canvas 読込前の下地 (深いインクプラム + 上部のピンクの光)
        background: 'radial-gradient(circle at 50% 10%, rgba(255,122,166,0.28) 0%, rgba(225,48,108,0.10) 40%, transparent 62%), linear-gradient(180deg, #2E1038 0%, #1A0A26 100%)',
        boxShadow: '0 18px 48px rgba(26,10,38,0.35)',
      }}>
        {/* 静的 SVG の花 (WebGL 不可 / 読込中はこれが見える) */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingBottom: '17%',
        }}>
          <FallbackFlower />
        </div>

        {/* 実 3D (読み込めた時だけ上に乗る) */}
        <BloomBoundary>
          <React.Suspense fallback={null}>
            <div style={{ position: 'absolute', inset: 0, animation: 'iris-hero-fadein 0.9s ease both' }}>
              <IrisCrystalBloom />
            </div>
          </React.Suspense>
        </BloomBoundary>

        {/* 前面下部: IRIS + 一言 (濃背景に白文字 + text-shadow) */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '3rem 1rem 1.2rem',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(26,10,38,0) 0%, rgba(26,10,38,0.66) 85%)',
          pointerEvents: 'none',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: IRIS_FONTS.display,
            fontWeight: 600,
            fontSize: 'clamp(2rem, 9vw, 3rem)',
            letterSpacing: '0.4em',
            paddingLeft: '0.4em', // letter-spacing の右余りを打ち消して光学的にセンターへ
            textTransform: 'uppercase',
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 2px 26px rgba(26,10,38,0.9), 0 1px 3px rgba(26,10,38,0.6)',
          }}>
            Iris
          </h1>
          <p style={{
            margin: '0.55rem 0 0',
            fontFamily: IRIS_FONTS.serif,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 'clamp(0.98rem, 4.2vw, 1.25rem)',
            lineHeight: 1.6,
            color: '#FFFFFF',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            textShadow: '0 2px 18px rgba(26,10,38,0.9), 0 1px 3px rgba(26,10,38,0.65)',
          }}>
            思考を投げるだけ。<br />あとは Iris が、投稿から案件まで仕上げる。
          </p>
        </div>
      </div>

      {/* ── 巨大入力 (IrisThoughtDropSection) ── */}
      {children}

      {/* ── ガラスチップ 3 つ: 多機能への入口 ── */}
      {onNavigate && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
          {CHIPS.map(({ tab, label, Icon, grad }) => (
            <motion.button
              key={tab}
              type="button"
              onClick={() => onNavigate(tab)}
              whileTap={{ scale: 0.96 }}
              aria-label={`${label}を開く`}
              style={{
                minHeight: 78,
                border: `1px solid ${bg.cardBorder}`,
                borderRadius: 18,
                background: bg.card,
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                boxShadow: '0 4px 18px rgba(26,10,38,0.08)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '0.7rem 0.35rem',
              }}
            >
              <span aria-hidden style={{
                width: 34, height: 34, borderRadius: 11,
                background: grad,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(225,48,108,0.3)',
              }}>
                <Icon size={17} color="#FFFFFF" strokeWidth={2.2} />
              </span>
              <span style={{
                fontSize: '0.8rem', fontWeight: 700,
                color: bg.ink, fontFamily: IRIS_FONTS.body,
                lineHeight: 1.2, whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes iris-hero-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes iris-hero-fadein { from { opacity: 1; } to { opacity: 1; } }
        }
      `}</style>
    </section>
  );
}
