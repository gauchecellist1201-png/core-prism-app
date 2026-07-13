// ============================================================
// PrismBloomHero — ランディング1画面目の全画面ヒーロー (2026-07-02)
// オーナー指示: 「Crystal同様、ロゴが全画面で動き出すUIを全サービスに」
// 虹の多面体プリズム (Logo.tsx PrismLogo と同ジオメトリ) が
// パネル1枚ずつ組み上がり → 完成後に分光の光が走り、ゆっくり呼吸する。
// 純CSS/SVGのみ。prefers-reduced-motion では静止。
// ============================================================

interface Props {
  /** 主CTA (はじめる) — 既存の onEnterApp を渡す */
  onStart: () => void;
}

// PrismLogo と同じ 9+1 パネル (points / fill / 組み上がり順)
const PANELS: Array<{ pts: string; fill: string; op?: number }> = [
  { pts: '10,92 30,55 40,75', fill: '#FFD60A' },
  { pts: '10,92 40,75 60,75', fill: '#F77F00' },
  { pts: '60,75 78,55 90,92', fill: '#06A77D' },
  { pts: '60,75 90,92 88,38', fill: '#5B2C8A', op: 0.7 },
  { pts: '30,55 50,55 40,75', fill: '#E1306C' },
  { pts: '50,55 78,55 60,75', fill: '#833AB4' },
  { pts: '65,32 50,55 78,55', fill: '#06A77D' },
  { pts: '65,32 78,55 88,38', fill: '#118AB2' },
  { pts: '50,5 50,55 65,32', fill: '#7B2CBF' },
  { pts: '50,5 30,55 50,55', fill: '#C13584' },
];

export default function PrismBloomHero({ onStart }: Props) {
  return (
    <section
      aria-label="CORE Prism"
      style={{
        position: 'relative', height: '100svh', minHeight: 560, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(120% 90% at 50% -10%, #EAE6F5 0%, #F2EEFA 45%, #FFFFFF 100%)',
      }}
    >
      <style>{`
        .pbh-panel { opacity: 0; transform-origin: 50px 60px; transform: scale(0.6) translateY(8px); rotate: -6deg;
                     animation: pbhIn 0.9s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes pbhIn { to { opacity: 1; transform: scale(1) translateY(0); rotate: 0deg; } }
        .pbh-svg { animation: pbhBreathe 7s ease-in-out 2.4s infinite; }
        @keyframes pbhBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
        .pbh-glint { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen; filter: blur(10px);
                     background: conic-gradient(from 0deg, transparent 0 70%, rgba(0,0,0,0.14) 76%, transparent 83%);
                     opacity: 0; animation: pbhGlint 11s linear 2.2s infinite; }
        @keyframes pbhGlint { 0% { opacity: 0; transform: rotate(0deg); } 6% { opacity: 1; }
                              50% { opacity: 1; } 100% { opacity: 0.4; transform: rotate(360deg); } }
        .pbh-fade { opacity: 0; animation: pbhFade 1.1s ease-out forwards; }
        @keyframes pbhFade { to { opacity: 1; } }
        .pbh-hint { animation: pbhHint 2.2s ease-in-out 3s infinite; opacity: 0.55; }
        @keyframes pbhHint { 0%,100% { transform: translateY(0); } 50% { transform: translateY(7px); } }
        @media (prefers-reduced-motion: reduce) {
          .pbh-panel { animation: none; opacity: 1; transform: none; rotate: 0deg; }
          .pbh-svg, .pbh-glint, .pbh-hint { animation: none; }
          .pbh-fade { animation: none; opacity: 1; }
        }
      `}</style>

      {/* 虹のオーラ */}
      <div aria-hidden style={{
        position: 'absolute', left: '50%', top: '38%', width: 'min(120vw, 900px)', aspectRatio: '1/1',
        transform: 'translate(-50%,-50%)', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(167,139,250,0.22) 0%, rgba(244,114,182,0.10) 38%, transparent 68%)',
        filter: 'blur(30px)',
      }} />

      {/* 全画面プリズム (パネルが組み上がる) */}
      <div style={{ position: 'relative', width: 'min(52svh, 78vw, 460px)' }}>
        <svg className="pbh-svg" viewBox="0 0 100 100" width="100%" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
          {PANELS.map((p, i) => (
            <polygon
              key={i}
              className="pbh-panel"
              points={p.pts}
              fill={p.fill}
              opacity={p.op ?? 1}
              style={{ animationDelay: `${0.18 + i * 0.14}s` }}
            />
          ))}
        </svg>
        <div className="pbh-glint" aria-hidden style={{ borderRadius: '50%' }} />
      </div>

      {/* 言葉 */}
      <div className="pbh-fade" style={{ textAlign: 'center', padding: '0 20px', marginTop: 'clamp(14px, 3svh, 30px)', animationDelay: '1.5s', zIndex: 2 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 6vw, 46px)', fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.25 }}>
          <span style={{ background: 'linear-gradient(90deg,#fbbf24,#f472b6,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CORE Prism
          </span>
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 'clamp(15px, 2.6vw, 19px)', lineHeight: 1.85, fontWeight: 600, color: 'rgba(0,0,0,0.82)' }}>
          社長のやりたくない事務・資料・数字を、<br />AIが片づける。あなたは、決めるだけ。
        </p>
        <button
          onClick={onStart}
          style={{
            marginTop: 22, minHeight: 52, padding: '14px 34px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(90deg,#a78bfa,#f472b6)', color: '#14091f',
            fontSize: 15, fontWeight: 800, letterSpacing: '0.04em',
            boxShadow: '0 12px 40px rgba(167,139,250,0.35)',
          }}
        >
          いますぐはじめる
        </button>
      </div>

      {/* 下へ */}
      <div className="pbh-hint" aria-hidden style={{ position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </section>
  );
}
