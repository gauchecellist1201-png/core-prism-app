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
//  CORE Prism — プリズムから七色のスペクトルが分散するシンボル
//  虹の七色 (赤・橙・黄・緑・青・藍・紫) で実物のプリズム分光を表現
// ─────────────────────────────────────────────
export function PrismLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  // 虹の七色 (波長順、長波長 → 短波長)
  const RAINBOW = ['#FF1744', '#FF8A1A', '#FFD600', '#10C66B', '#2E6FFF', '#5C3FCF', '#9D2BE8'];
  const colors = variant === 'mono'
    ? { triangle: 'currentColor', rays: Array(7).fill('currentColor'), text: 'currentColor', accent: 'currentColor' }
    : {
        triangle: '#0E1738',
        rays: RAINBOW,
        text: '#1F1D26',
        accent: '#FF6B35',
      };

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: withWordmark ? 10 : 0, lineHeight: 1 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="CORE Prism"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* プリズム本体: ガラス感のあるダークブルーのグラデ */}
          <linearGradient id="prism-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#1F2E5C" />
            <stop offset="50%" stopColor="#0E1738" />
            <stop offset="100%" stopColor="#2A3F7A" />
          </linearGradient>
          {/* 入射光: 白 → 透明 (光の道) */}
          <linearGradient id="prism-incident" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#F0F4FF" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* 入射光 (左から、ベベル) */}
        <line x1="2" y1="32" x2="20" y2="32" stroke="url(#prism-incident)" strokeWidth="2.5" strokeLinecap="round" />

        {/* 三角形プリズム — ガラス調グラデ + ハイライト */}
        <polygon
          points="20,52 44,32 20,12"
          fill={variant === 'mono' ? 'currentColor' : 'url(#prism-grad)'}
          stroke={colors.triangle}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* 三角形のハイライト (内側の白い面) */}
        {variant !== 'mono' && (
          <polygon
            points="22,48 26,46 26,18 22,16"
            fill="#FFFFFF"
            opacity="0.18"
          />
        )}

        {/* 屈折された 7 本の光線 (虹のスペクトル) — 出射点を上下に分散 */}
        {[8, 16, 24, 32, 40, 48, 56].map((y2, i) => (
          <line
            key={i}
            x1="44"
            y1="32"
            x2="62"
            y2={y2}
            stroke={colors.rays[i]}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity={variant === 'mono' ? 0.6 : 0.95}
          />
        ))}
      </svg>

      {withWordmark && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: '"Inter", "Helvetica Neue", "Noto Sans JP", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: size * 0.5,
            letterSpacing: '0.18em',
            color: colors.text,
          }}>
            CORE
          </span>
          <span style={{
            fontFamily: '"Inter", "Helvetica Neue", "Noto Sans JP", system-ui, sans-serif',
            fontWeight: 400,
            fontSize: size * 0.34,
            letterSpacing: '0.25em',
            color: colors.accent,
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
//  IRIS — 花のアイリス + 目の虹彩 を抽象化
//  Instagram (Edits) 風の柔らかいグラデ
// ─────────────────────────────────────────────
export function IrisLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: withWordmark ? 10 : 0, lineHeight: 1 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="IRIS"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* Instagram 公式グラデを 4 段階で正確に */}
          <linearGradient id="iris-petal-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#833AB4" />
            <stop offset="100%" stopColor="#C13584" />
          </linearGradient>
          <linearGradient id="iris-petal-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#E1306C" />
            <stop offset="100%" stopColor="#F56040" />
          </linearGradient>
          <linearGradient id="iris-petal-3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#FD1D1D" />
            <stop offset="100%" stopColor="#FCB045" />
          </linearGradient>
          <radialGradient id="iris-center" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#FFFFFF" />
            <stop offset="40%"  stopColor="#FCB045" />
            <stop offset="100%" stopColor="#E1306C" />
          </radialGradient>
        </defs>

        {/* 中央: 6 弁の花 (花のアイリス + 目の虹彩) — 各花弁を Instagram グラデで */}
        {/* 上 */}
        <path
          d="M 32 4 C 28 14, 28 24, 32 32 C 36 24, 36 14, 32 4 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-petal-1)'}
          opacity={isMono ? 0.85 : 1}
        />
        {/* 右上 */}
        <path
          d="M 56 12 C 46 16, 38 22, 32 32 C 42 30, 50 24, 56 12 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-petal-2)'}
          opacity={isMono ? 0.78 : 0.95}
        />
        {/* 右下 */}
        <path
          d="M 56 52 C 46 48, 38 42, 32 32 C 42 34, 50 40, 56 52 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-petal-3)'}
          opacity={isMono ? 0.72 : 0.95}
        />
        {/* 下 */}
        <path
          d="M 32 60 C 28 50, 28 40, 32 32 C 36 40, 36 50, 32 60 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-petal-1)'}
          opacity={isMono ? 0.68 : 0.95}
        />
        {/* 左下 */}
        <path
          d="M 8 52 C 18 48, 26 42, 32 32 C 22 34, 14 40, 8 52 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-petal-2)'}
          opacity={isMono ? 0.72 : 0.95}
        />
        {/* 左上 */}
        <path
          d="M 8 12 C 18 16, 26 22, 32 32 C 22 30, 14 24, 8 12 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-petal-3)'}
          opacity={isMono ? 0.78 : 0.95}
        />

        {/* 中心の虹彩 (目) — グラデ */}
        <circle
          cx="32" cy="32" r="7"
          fill={isMono ? 'currentColor' : 'url(#iris-center)'}
        />
        {/* 瞳 (黒に近いインク) */}
        {!isMono && <circle cx="32" cy="32" r="2.5" fill="#1A0A26" />}
        {/* ハイライト */}
        {!isMono && <circle cx="33.5" cy="30.5" r="1.2" fill="#FFFFFF" />}
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
