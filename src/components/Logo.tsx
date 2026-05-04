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
//  CORE Prism — 多面体三角プリズム (ポリゴン分割)
//  虹色のパネルで構成される 3D 折り紙風の三角形
// ─────────────────────────────────────────────
export function PrismLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';

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
        aria-label="CORE Prism"
        style={{ flexShrink: 0 }}
      >
        {/*
          多面体プリズム — 大三角形を 9 面のパネルに分割
          頂点: top (50,5)、底辺左 (10,92)、底辺右 (90,92)
          内部分割点で各パネルを配置、虹のスペクトル順に色を割当
        */}
        <g opacity={isMono ? 0.85 : 1}>
          {/* 上部 左パネル (マゼンタ) */}
          <polygon points="50,5 30,55 50,55" fill={isMono ? 'currentColor' : '#C13584'} />
          {/* 上部 右上パネル (紫) */}
          <polygon points="50,5 50,55 65,32" fill={isMono ? 'currentColor' : '#7B2CBF'} />
          {/* 上部 右下 (ティール) */}
          <polygon points="65,32 50,55 78,55" fill={isMono ? 'currentColor' : '#06A77D'} />
          {/* 右上面 (青) */}
          <polygon points="65,32 78,55 88,38" fill={isMono ? 'currentColor' : '#118AB2'} />
          {/* 中央 (マゼンタ濃) */}
          <polygon points="30,55 50,55 40,75" fill={isMono ? 'currentColor' : '#E1306C'} />
          {/* 中央右 (パープル) */}
          <polygon points="50,55 78,55 60,75" fill={isMono ? 'currentColor' : '#833AB4'} />
          {/* 下左 (黄〜オレンジ) */}
          <polygon points="10,92 30,55 40,75" fill={isMono ? 'currentColor' : '#FFD60A'} />
          {/* 下中央 (オレンジ) */}
          <polygon points="10,92 40,75 60,75" fill={isMono ? 'currentColor' : '#F77F00'} />
          {/* 下右 (緑) */}
          <polygon points="60,75 78,55 90,92" fill={isMono ? 'currentColor' : '#06A77D'} />
          {/* 中央右下 (緑〜青のグラデ) */}
          <polygon points="40,75 60,75 90,92 10,92" fill={isMono ? 'currentColor' : '#84C44A'} opacity="0.0" />
          {/* 右下端の細い緑のライン */}
          <polygon points="60,75 90,92 88,38" fill={isMono ? 'currentColor' : '#5B2C8A'} opacity="0.7" />
        </g>

        {/* 全体の輪郭をうっすら強調 (高級感を出すサブトルなライン) */}
        <polygon points="50,5 90,92 10,92" fill="none"
          stroke={isMono ? 'currentColor' : 'rgba(255,255,255,0.0)'}
          strokeWidth="0" />
      </svg>

      {withWordmark && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            className={isMono ? '' : 'text-prism'}
            style={{
              fontFamily: '"Inter", "Helvetica Neue", "Noto Sans JP", system-ui, sans-serif',
              fontWeight: 800,
              fontSize: size * 0.5,
              letterSpacing: '0.18em',
              ...(isMono ? { color: 'currentColor' } : {}),
            }}
          >
            CORE
          </span>
          <span
            className={isMono ? '' : 'text-prism'}
            style={{
              fontFamily: '"Inter", "Helvetica Neue", "Noto Sans JP", system-ui, sans-serif',
              fontWeight: 500,
              fontSize: size * 0.34,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginTop: 2,
              ...(isMono ? { color: 'currentColor' } : {}),
            }}
          >
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
