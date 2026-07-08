// ============================================================
// IrisBloomHero — Iris ランディング1画面目の全画面ヒーロー (2026-07-08)
// オーナー指示: 「アイコンが3Dで浮かび上がるデザインに全サービス統一」。
// Iris の 6 弁花が 1 枚ずつ開花 → 完成後、奥行きのある 3D 浮遊 + 分光グリント + 呼吸。
// 純CSS/SVGのみ・rAF非依存(CSSアニメ)・prefers-reduced-motion では静止。
// ★統一フォーミュラ: perspective の器 + entry rise(translateZ/scale) + rotateX/Y 揺らぎ + aura + glint。
//   Crystal/Lume/Resonance も同じ CSS 変数名(ibh-*)で横展開する。
// ============================================================

import { IRIS_COLORS } from './irisStyle';

interface Props {
  onStart: () => void;
}

// IrisLogo と同じ 6 弁花 (60° 刻み・二重ライン)。開花順は下→上で咲かせる。
const PETALS = [0, 60, 120, 180, 240, 300];

export default function IrisBloomHero({ onStart }: Props) {
  return (
    <section
      aria-label="CORE Iris"
      style={{
        position: 'relative', height: '100svh', minHeight: 560, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(120% 90% at 50% -10%, #2a0f24 0%, #1a0a1a 45%, #0d0710 100%)',
        perspective: '900px',
        paddingBottom: 'calc(186px + env(safe-area-inset-bottom))', // 下部 CORE ドック + 上部バナー分を避ける
      }}
    >
      <style>{`
        /* 花弁の開花: 中心から回りながら開く */
        /* 開花は inner g にのみ効かせる(scale+opacity)。位置の rotate は outer g の属性が担う
           = CSS transform が SVG rotate 属性を上書きして全弁が重なる事故を防ぐ */
        .ibh-petal { opacity: 0; transform-origin: 50px 50px;
                     transform: scale(0.25); animation: ibhBloom 0.85s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes ibhBloom { to { opacity: 1; transform: scale(1); } }
        /* 3D浮遊: 奥から立ち上がり(entry) → ゆっくり傾いて漂う(loop) */
        .ibh-stage { transform-style: preserve-3d; opacity: 0;
                     animation: ibhRise 1.1s cubic-bezier(0.16,1,0.3,1) 0.1s forwards, ibhFloat 8s ease-in-out 1.4s infinite; }
        @keyframes ibhRise { from { opacity: 0; transform: translateY(26px) translateZ(-140px) scale(0.9); }
                             to   { opacity: 1; transform: translateY(0) translateZ(0) scale(1); } }
        @keyframes ibhFloat { 0%,100% { transform: rotateY(-11deg) rotateX(7deg) translateY(0); }
                              50%     { transform: rotateY(11deg)  rotateX(-4deg) translateY(-14px); } }
        .ibh-glint { position: absolute; inset: -10%; pointer-events: none; mix-blend-mode: screen; filter: blur(12px);
                     background: conic-gradient(from 0deg, transparent 0 70%, rgba(255,255,255,0.16) 76%, transparent 83%);
                     opacity: 0; animation: ibhGlint 11s linear 2s infinite; border-radius: 50%; }
        @keyframes ibhGlint { 0% { opacity: 0; transform: rotate(0deg); } 6% { opacity: 1; } 50% { opacity: 1; } 100% { opacity: 0.4; transform: rotate(360deg); } }
        .ibh-fade { opacity: 0; animation: ibhFade 1.1s ease-out 1.5s forwards; }
        @keyframes ibhFade { to { opacity: 1; } }
        .ibh-hint { animation: ibhHint 2.2s ease-in-out 3s infinite; opacity: 0.55; }
        @keyframes ibhHint { 0%,100% { transform: translateY(0); } 50% { transform: translateY(7px); } }
        @media (prefers-reduced-motion: reduce) {
          .ibh-petal { animation: none; opacity: 1; transform: none; }
          .ibh-stage { animation: none; opacity: 1; transform: none; }
          .ibh-glint, .ibh-hint { animation: none; }
          .ibh-fade { animation: none; opacity: 1; }
        }
      `}</style>

      {/* オーロラのオーラ */}
      <div aria-hidden style={{
        position: 'absolute', left: '50%', top: '40%', width: 'min(120vw, 900px)', aspectRatio: '1/1',
        transform: 'translate(-50%,-50%)', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(225,48,108,0.20) 0%, rgba(247,119,55,0.10) 38%, transparent 68%)',
        filter: 'blur(34px)',
      }} />

      {/* 3D浮遊する花 */}
      <div className="ibh-stage" style={{ position: 'relative', width: 'min(30svh, 50vw, 260px)' }}>
        <svg viewBox="0 0 100 100" width="100%" aria-hidden style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 22px 44px rgba(225,48,108,0.28))' }}>
          <defs>
            <linearGradient id="ibh-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF8A1A" /><stop offset="25%" stopColor="#F77737" />
              <stop offset="50%" stopColor="#E1306C" /><stop offset="75%" stopColor="#C13584" />
              <stop offset="100%" stopColor="#833AB4" />
            </linearGradient>
          </defs>
          <g stroke="url(#ibh-grad)" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round">
            {PETALS.map((rot, i) => (
              // 外g=位置の回転(60°刻み) / 内g=開花アニメ(scale+opacity)。分離が肝
              <g key={rot} transform={`rotate(${rot} 50 50)`}>
                <g className="ibh-petal" style={{ animationDelay: `${0.2 + i * 0.13}s` }}>
                  <path d="M 50 12 C 42 24, 42 38, 50 50 C 58 38, 58 24, 50 12 Z" />
                  <path d="M 50 18 C 45 28, 45 38, 50 47 C 55 38, 55 28, 50 18 Z" strokeWidth="2" />
                </g>
              </g>
            ))}
          </g>
        </svg>
        <div className="ibh-glint" aria-hidden />
      </div>

      {/* 言葉 */}
      <div className="ibh-fade" style={{ textAlign: 'center', padding: '0 20px', marginTop: 'clamp(8px, 1.8svh, 18px)', zIndex: 2 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 6vw, 46px)', fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.25, fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", serif', fontStyle: 'italic' }}>
          <span style={{ background: 'linear-gradient(120deg,#FF8A1A,#E1306C,#C13584,#833AB4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CORE Iris
          </span>
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 'clamp(14px, 2.4vw, 17px)', lineHeight: 1.9, color: 'rgba(255,250,245,0.82)' }}>
          Instagram に、専属マネージャー AI を。
        </p>
        <button
          onClick={onStart}
          style={{
            // ★Iris 共通 CTA フォーミュラに統一(ctaBtnHero と同じ: 135deg hotPink→purple→gold + 二層シャドウ)
            marginTop: 22, minHeight: 52, padding: '14px 34px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink} 0%, ${IRIS_COLORS.purple} 50%, ${IRIS_COLORS.gold} 100%)`,
            color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '0.04em',
            boxShadow: `0 14px 40px ${IRIS_COLORS.hotPink}60, 0 4px 12px ${IRIS_COLORS.purple}40`,
            transition: 'transform 0.12s, box-shadow 0.12s',
          }}
        >
          いますぐはじめる
        </button>
      </div>

      {/* 下へ */}
      <div className="ibh-hint" aria-hidden style={{ position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </section>
  );
}
