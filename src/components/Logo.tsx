// ============================================================
// CORE Prism / IRIS — ブランドロゴ (SVG)
// 共通モジュールで両ブランドのロゴを定義
// ============================================================

interface LogoProps {
  size?: number;          // アイコン高さ (px)
  withWordmark?: boolean; // ワードマーク (テキスト) を付ける
  variant?: 'default' | 'mono';
  className?: string;
}

// ─────────────────────────────────────────────
//  CORE Prism — Pink Floyd 「The Dark Side of the Moon」風
//  ガラス三角プリズム + 七色の虹色光線が右に広がる
//  虹の正しい順序: 赤 → 橙 → 黄 → 緑 → 青 → 藍 → 紫
// ─────────────────────────────────────────────
export function PrismLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  // 虹の七色 (光のスペクトル順、長波長 → 短波長)
  const RAINBOW = [
    '#E63946',  // 赤
    '#F77F00',  // 橙
    '#FFD60A',  // 黄
    '#06A77D',  // 緑
    '#118AB2',  // 青
    '#4361EE',  // 藍
    '#7B2CBF',  // 紫
  ];

  const isMono = variant === 'mono';
  const gid = 'prism-grad-' + size;

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: withWordmark ? 10 : 0, lineHeight: 1 }}
    >
      <svg
        width={size * 1.6}
        height={size}
        viewBox="0 0 100 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="CORE Prism"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* ガラスのグラデ (内側に行くほど透明、エッジが光る) */}
          <linearGradient id={`${gid}-glass`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#9CB1D9" stopOpacity="0.38" />
            <stop offset="50%"  stopColor="#3D5A9E" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#9CB1D9" stopOpacity="0.32" />
          </linearGradient>
          {/* ガラスのエッジ (細い白いハイライト線) */}
          <linearGradient id={`${gid}-edge`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.55" />
          </linearGradient>
          {/* 入射白色光: 左から三角形の左面に当たる */}
          <linearGradient id={`${gid}-incident`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* 入射白色光 — 左から三角形の左斜面の中央に向かう */}
        <line
          x1="2" y1="32"
          x2="32" y2="32"
          stroke={isMono ? 'currentColor' : `url(#${gid}-incident)`}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity={isMono ? 0.7 : 1}
        />

        {/* 三角形プリズム (ガラス) */}
        {/* 内側のガラス本体 */}
        <polygon
          points="50,8 28,52 72,52"
          fill={isMono ? 'currentColor' : `url(#${gid}-glass)`}
          opacity={isMono ? 0.18 : 1}
        />
        {/* 左エッジ (光が反射してる感じ) */}
        <line x1="50" y1="8" x2="28" y2="52"
          stroke={isMono ? 'currentColor' : `url(#${gid}-edge)`}
          strokeWidth="1.6" strokeLinecap="round" />
        {/* 右エッジ */}
        <line x1="50" y1="8" x2="72" y2="52"
          stroke={isMono ? 'currentColor' : `url(#${gid}-edge)`}
          strokeWidth="1.6" strokeLinecap="round"
          opacity={isMono ? 0.6 : 0.85} />
        {/* 底辺 */}
        <line x1="28" y1="52" x2="72" y2="52"
          stroke={isMono ? 'currentColor' : `url(#${gid}-edge)`}
          strokeWidth="1.4" strokeLinecap="round"
          opacity={isMono ? 0.5 : 0.55} />

        {/* 虹色のスペクトル光線 — 三角形の右下から右に広がる帯 (7 本) */}
        {/* 屈折点: 右斜面の中央付近 (約 60, 32) から、右に向かって扇状に */}
        {RAINBOW.map((color, i) => {
          // 7 本を扇状に配置 (上→赤, 下→紫)
          const startY = 32 - 1 + i * 0.3;       // 屈折点で密に
          const endY   = 22 + i * 4;              // 出口で扇状に
          return (
            <line
              key={i}
              x1="60" y1={startY}
              x2="98" y2={endY}
              stroke={isMono ? 'currentColor' : color}
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity={isMono ? (0.4 + i * 0.05) : 0.95}
            />
          );
        })}
      </svg>

      {withWordmark && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: '"Inter", "Helvetica Neue", "Noto Sans JP", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: size * 0.5,
            letterSpacing: '0.18em',
            color: isMono ? 'currentColor' : '#1F1D26',
          }}>
            CORE
          </span>
          <span style={{
            fontFamily: '"Inter", "Helvetica Neue", "Noto Sans JP", system-ui, sans-serif',
            fontWeight: 400,
            fontSize: size * 0.34,
            letterSpacing: '0.25em',
            color: isMono ? 'currentColor' : '#FF6B35',
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            Prism
          </span>
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
//  IRIS — 二重ラインの 6 弁花 (Instagram グラデ)
//  ユーザー指定のフラワーシンボル
// ─────────────────────────────────────────────
export function IrisLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';

  // ユニークな gradient id (複数インスタンスで衝突しないよう)
  const gradId = 'iris-line-grad-' + size;

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: withWordmark ? 10 : 0, lineHeight: 1 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="IRIS"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* Instagram グラデ: オレンジ → 赤 → マゼンタ → パープル */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"    stopColor="#FF8A1A" />
            <stop offset="25%"   stopColor="#F77737" />
            <stop offset="50%"   stopColor="#E1306C" />
            <stop offset="75%"   stopColor="#C13584" />
            <stop offset="100%"  stopColor="#833AB4" />
          </linearGradient>
        </defs>

        {/* 二重ラインの 6 弁花 (60° 刻み) */}
        <g
          stroke={isMono ? 'currentColor' : `url(#${gradId})`}
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={isMono ? 0.9 : 1}
        >
          {[0, 60, 120, 180, 240, 300].map(rot => (
            <g key={rot} transform={`rotate(${rot} 50 50)`}>
              <path d="M 50 12 C 42 24, 42 38, 50 50 C 58 38, 58 24, 50 12 Z" />
              <path d="M 50 18 C 45 28, 45 38, 50 47 C 55 38, 55 28, 50 18 Z" strokeWidth="2" />
            </g>
          ))}
        </g>
      </svg>

      {withWordmark && (
        <span style={{
          // Cormorant Garamond italic — 上品なセリフ書体
          fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", serif',
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: size * 0.95,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          ...(isMono ? { color: 'currentColor' } : {
            background: 'linear-gradient(135deg, #833AB4 0%, #E1306C 50%, #F77737 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }),
        }}>
          Iris
        </span>
      )}
    </span>
  );
}
