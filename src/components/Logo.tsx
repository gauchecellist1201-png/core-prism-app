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
//  CORE Prism — プリズムから光が分散するシンボル
//  5 波長 (logic / empathy / creative / action / ethics) を 5 本の光線で表現
// ─────────────────────────────────────────────
export function PrismLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const colors = variant === 'mono'
    ? { triangle: 'currentColor', rays: ['currentColor', 'currentColor', 'currentColor', 'currentColor', 'currentColor'], text: 'currentColor', accent: 'currentColor' }
    : {
        triangle: '#0033A0',
        rays: ['#2E6FFF', '#E84B97', '#8E5CFF', '#FF7A1A', '#D9A41A'], // 5 波長カラー
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
        {/* 入射光 (左から) */}
        <line x1="2"  y1="32" x2="20" y2="32" stroke={colors.text} strokeWidth="1.5" strokeLinecap="round" />

        {/* 三角形プリズム — グラデ塗り */}
        <defs>
          <linearGradient id="prism-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#0033A0" />
            <stop offset="100%" stopColor="#1A4FC4" />
          </linearGradient>
        </defs>
        <polygon
          points="20,52 44,32 20,12"
          fill={variant === 'mono' ? 'currentColor' : 'url(#prism-grad)'}
          stroke={colors.triangle}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* 屈折された 5 本の光線 (5 波長) */}
        {[
          { y2: 14, color: colors.rays[0] },
          { y2: 22, color: colors.rays[1] },
          { y2: 32, color: colors.rays[2] },
          { y2: 42, color: colors.rays[3] },
          { y2: 50, color: colors.rays[4] },
        ].map((r, i) => (
          <line
            key={i}
            x1="44"
            y1="32"
            x2="62"
            y2={r.y2}
            stroke={r.color}
            strokeWidth="1.5"
            strokeLinecap="round"
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
          <linearGradient id="iris-grad-petal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#833AB4" />
            <stop offset="40%"  stopColor="#E1306C" />
            <stop offset="75%"  stopColor="#F77737" />
            <stop offset="100%" stopColor="#FCB045" />
          </linearGradient>
          <radialGradient id="iris-grad-pupil" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E1306C" />
          </radialGradient>
        </defs>

        {/* 上の花弁 */}
        <path
          d="M 32,4 C 24,12 24,22 32,32 C 40,22 40,12 32,4 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-grad-petal)'}
          opacity={isMono ? 0.85 : 0.95}
        />
        {/* 左下花弁 */}
        <path
          d="M 4,38 C 14,34 24,36 32,32 C 28,42 18,46 8,44 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-grad-petal)'}
          opacity={isMono ? 0.7 : 0.9}
        />
        {/* 右下花弁 */}
        <path
          d="M 60,38 C 50,34 40,36 32,32 C 36,42 46,46 56,44 Z"
          fill={isMono ? 'currentColor' : 'url(#iris-grad-petal)'}
          opacity={isMono ? 0.7 : 0.9}
        />

        {/* 中心の虹彩 (目) */}
        <circle
          cx="32" cy="32" r="6"
          fill={isMono ? 'currentColor' : 'url(#iris-grad-pupil)'}
        />
        {/* 中心ハイライト */}
        {!isMono && (
          <circle cx="34" cy="30" r="1.5" fill="#FFFFFF" opacity="0.85" />
        )}
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
