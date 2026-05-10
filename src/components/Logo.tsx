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

// ─────────────────────────────────────────────
//  CORE Inc. — 法人ロゴ (同心円 + 8 本スポーク + 中央の核)
//  「核」の本質: 中心から世界へ放射する光
//  青白いシアン基調の発光、Apple Vision/SF 的な精緻さ
// ─────────────────────────────────────────────
export function CoreLogo({ size = 32, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';
  const filterId = `coreGlow-${size}`;
  const gradId = `coreGrad-${size}`;
  const coreGradId = `coreCenter-${size}`;

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: withWordmark ? 12 : 0, lineHeight: 1 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="CORE Inc."
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* 外周リング グラデーション (シアン → ホワイト) */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#7DD3FC" />
            <stop offset="50%"  stopColor="#E0F2FE" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
          {/* 中央核: 高輝度の球体 */}
          <radialGradient id={coreGradId} cx="50%" cy="40%" r="60%">
            <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="55%" stopColor="#BAE6FD" stopOpacity="1" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="1" />
          </radialGradient>
          {/* グロー効果 (光のにじみ) */}
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          stroke={isMono ? 'currentColor' : `url(#${gradId})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={isMono ? undefined : `url(#${filterId})`}
          opacity={isMono ? 0.92 : 1}
        >
          {/* 外周大円 (太め) */}
          <circle cx="50" cy="50" r="44" strokeWidth="3.4" />
          {/* 中円 */}
          <circle cx="50" cy="50" r="28" strokeWidth="2.4" />
          {/* 小円 (核を包む) */}
          <circle cx="50" cy="50" r="12" strokeWidth="1.8" />

          {/* 8 本スポーク (45° 刻み)
               外周 r=44 から 中円 r=28 までを描画 (中央は核を残す) */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 50 + Math.cos(rad) * 44;
            const y1 = 50 + Math.sin(rad) * 44;
            const x2 = 50 + Math.cos(rad) * 12;
            const y2 = 50 + Math.sin(rad) * 12;
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.6" />;
          })}
        </g>

        {/* 中央の核 (発光する球) */}
        <circle
          cx="50" cy="50" r="7"
          fill={isMono ? 'currentColor' : `url(#${coreGradId})`}
          opacity={isMono ? 0.95 : 1}
        />
        {/* ハイライト */}
        {!isMono && (
          <circle cx="48" cy="47" r="2.2" fill="#FFFFFF" opacity="0.85" />
        )}
      </svg>

      {withWordmark && (
        <span
          aria-hidden
          style={{
            fontFamily: '"Cinzel", "Noto Serif JP", serif',
            fontSize: size * 0.62,
            fontWeight: 700,
            letterSpacing: '0.42em',
            paddingLeft: '0.42em',
            color: isMono ? 'inherit' : '#E0F2FE',
            background: isMono ? undefined : 'linear-gradient(135deg, #FFFFFF, #BAE6FD, #38BDF8)',
            WebkitBackgroundClip: isMono ? undefined : 'text',
            WebkitTextFillColor: isMono ? undefined : 'transparent',
            lineHeight: 1,
          }}
        >
          CORE
        </span>
      )}
    </span>
  );
}
