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
//  CORE Resonance — 同心の音紋 (響きあう波)
//  一点から広がる三重のアーク + 源の核。LINE グリーン → シアン
// ─────────────────────────────────────────────
export function ResonanceLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';
  const gradId = 'resonance-grad-' + size;

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
        aria-label="CORE Resonance"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* 響きのグラデ: グリーン → ティール → シアン */}
          <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#06C755" />
            <stop offset="55%"  stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>

        {/* 源の一点から広がる三重の音紋 (右上 90° のアーク) */}
        <g
          stroke={isMono ? 'currentColor' : `url(#${gradId})`}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M 28 50 A 22 22 0 0 1 50 72" opacity={isMono ? 0.9 : 1} />
          <path d="M 28 34 A 38 38 0 0 1 66 72" opacity={isMono ? 0.65 : 0.72} />
          <path d="M 28 18 A 54 54 0 0 1 82 72" opacity={isMono ? 0.4 : 0.45} />
        </g>
        {/* 源の核 */}
        <circle
          cx="28" cy="72" r="5.5"
          fill={isMono ? 'currentColor' : `url(#${gradId})`}
        />
      </svg>

      {withWordmark && (
        <span style={{
          fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", serif',
          fontWeight: 600,
          fontSize: size * 0.78,
          letterSpacing: '0.01em',
          lineHeight: 1,
          ...(isMono ? { color: 'currentColor' } : {
            background: 'linear-gradient(135deg, #06C755 0%, #14B8A6 55%, #0EA5E9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }),
        }}>
          Resonance
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
//  CORE Lume — 灯るオーブ (金〜オレンジのスクエア + 白く発光する球)
//  オーナー支給のアプリアイコンを忠実に再現。ゴールド〜オレンジ基調（光・ルーメン）。
// ─────────────────────────────────────────────
export function LumeLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';
  const sqId = 'lume-sq-' + size;
  const orbId = 'lume-orb-' + size;

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
        aria-label="CORE Lume"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* スクエア地: ゴールド → ディープオレンジ (斜め) */}
          <linearGradient id={sqId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#FFD86B" />
            <stop offset="45%"  stopColor="#FFA42A" />
            <stop offset="100%" stopColor="#FF7A18" />
          </linearGradient>
          {/* 発光オーブ: 白核 → ウォームのブルーム */}
          <radialGradient id={orbId} cx="50%" cy="43%" r="60%">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="30%"  stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="62%"  stopColor="#FFF1D6" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#FFF1D6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* スクイクル (角丸スクエア) */}
        <rect
          x="4" y="4" width="92" height="92" rx="26"
          fill={isMono ? 'currentColor' : `url(#${sqId})`}
          opacity={isMono ? 0.9 : 1}
        />
        {/* 発光ブルーム */}
        {!isMono && <circle cx="50" cy="43" r="33" fill={`url(#${orbId})`} />}
        {/* 明るい核 */}
        <circle cx="50" cy="43" r="15" fill={isMono ? '#fff' : '#FFFFFF'} opacity={isMono ? 0.95 : 1} />
        {/* スペキュラ ハイライト */}
        {!isMono && <circle cx="44" cy="37" r="4" fill="#FFFFFF" opacity="0.92" />}
      </svg>

      {withWordmark && (
        <span style={{
          fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", serif',
          fontStyle: 'italic',
          fontWeight: 600,
          fontSize: size * 0.92,
          letterSpacing: '0.01em',
          lineHeight: 1,
          ...(isMono ? { color: 'currentColor' } : {
            background: 'linear-gradient(135deg, #FFD86B 0%, #FFA42A 50%, #FF7A18 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }),
        }}>
          Lume
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
//  CORE Guild — 六角バッジ + 中心と 6 ノードのネットワーク (ティール発光)
//  貢献で決める組織 OS。社員・副業・フリーランス・AI をひとつのギルドへ。
// ─────────────────────────────────────────────
export function GuildLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';
  const gid = 'guild-grad-' + size;
  const fid = 'guild-glow-' + size;
  const nodes: [number, number][] = [[32, 8], [53, 20], [53, 44], [32, 56], [11, 44], [11, 20]];

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
        aria-label="CORE Guild"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5eead4" />
            <stop offset="0.55" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
          {!isMono && (
            <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>
        <g filter={isMono ? undefined : `url(#${fid})`} stroke={isMono ? 'currentColor' : `url(#${gid})`}>
          {/* 六角形のギルドバッジ */}
          <path d="M32 4 56 18 56 46 32 60 8 46 8 18Z" strokeWidth="2.4" strokeLinejoin="round" fill={isMono ? 'none' : 'rgba(45,212,191,0.06)'} />
          {/* 中心から各ノードへの接続線（コミュニティ） */}
          {nodes.map(([x, y], i) => (
            <line key={i} x1="32" y1="32" x2={x} y2={y} strokeWidth="1.4" opacity="0.7" />
          ))}
        </g>
        {/* ノード（発光ドット） */}
        {nodes.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill={isMono ? 'currentColor' : `url(#${gid})`} />
        ))}
        <circle cx="32" cy="32" r="5" fill={isMono ? 'currentColor' : `url(#${gid})`} />
        <circle cx="32" cy="32" r="9" stroke={isMono ? 'currentColor' : `url(#${gid})`} strokeWidth="1.4" opacity="0.5" />
      </svg>

      {withWordmark && (
        <span style={{
          fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", serif',
          fontWeight: 600,
          fontSize: size * 0.82,
          letterSpacing: '0.04em',
          lineHeight: 1,
          ...(isMono ? { color: 'currentColor' } : {
            background: 'linear-gradient(135deg, #5eead4 0%, #22d3ee 55%, #2dd4bf 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }),
        }}>
          Guild
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
//  Crystal — ガラスの蓮 (白×クリスタル×金)
//  外輪8弁のクリスタル花弁 + 内輪6弁 + 金の芯
//  /crystal の 3D クリスタル・ロータスをシンボル化
// ─────────────────────────────────────────────
export function CrystalLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';
  // 同一ページに複数置いてもグラデ ID が衝突しないよう size を織り込む
  const gOuter = `czlOuter-${size}`;
  const gInner = `czlInner-${size}`;
  const gCore = `czlCore-${size}`;

  const outerPetal = 'M50,8 C59,22 61,36 50,50 C39,36 41,22 50,8 Z';
  const innerPetal = 'M50,26 C56,34 57,43 50,50 C43,43 44,34 50,26 Z';

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
        aria-label="Crystal"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id={gOuter} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F4F7FC" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#C7D8F0" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#8FA8CC" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={gInner} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#D9E4F5" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id={gCore}>
            <stop offset="0%" stopColor="#FFF3DC" />
            <stop offset="55%" stopColor="#C9A96E" />
            <stop offset="100%" stopColor="#C9A96E" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* 外輪 8 弁 */}
        <g>
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={`o${i}`}
              d={outerPetal}
              fill={isMono ? 'currentColor' : `url(#${gOuter})`}
              opacity={isMono ? 0.5 : 1}
              stroke={isMono ? 'none' : 'rgba(255,255,255,0.85)'}
              strokeWidth="1.1"
              transform={`rotate(${i * 45} 50 50)`}
            />
          ))}
        </g>
        {/* 内輪 6 弁 */}
        <g>
          {Array.from({ length: 6 }, (_, i) => (
            <path
              key={`n${i}`}
              d={innerPetal}
              fill={isMono ? 'currentColor' : `url(#${gInner})`}
              opacity={isMono ? 0.8 : 1}
              stroke={isMono ? 'none' : 'rgba(255,255,255,0.9)'}
              strokeWidth="0.9"
              transform={`rotate(${i * 60 + 30} 50 50)`}
            />
          ))}
        </g>
        {/* 金の芯 */}
        <circle cx="50" cy="50" r="11" fill={isMono ? 'currentColor' : `url(#${gCore})`} />
        <circle cx="50" cy="50" r="4" fill={isMono ? 'currentColor' : '#FFF8EA'} />
      </svg>

      {withWordmark && (
        <span
          style={{
            fontFamily: '"Didot", "Bodoni 72", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif',
            fontWeight: 500,
            fontSize: size * 0.46,
            letterSpacing: '0.3em',
            ...(isMono ? { color: 'currentColor' } : { color: '#E8EFF9' }),
          }}
        >
          CRYSTAL
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
//  CORE Pulse — 鼓動が描くハート (ヘルスケア・ピンク)
//  脈波(心拍ライン)がハートの中を流れる、生命感のあるマーク。
//  ピンクグラデ #FF5C8A → #E8859E → #C9A192。淡いグローで上品に発光
// ─────────────────────────────────────────────
export function PulseLogo({ size = 28, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';
  const gradId = `pulse-grad-${size}`;
  const ecgGradId = `pulse-ecg-grad-${size}`;
  const glowId = `pulse-glow-${size}`;

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
        aria-label="CORE Pulse"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* ハート輪郭: ピンク → ローズ → ローズベージュ */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF5C8A" />
            <stop offset="55%" stopColor="#E8859E" />
            <stop offset="100%" stopColor="#C9A192" />
          </linearGradient>
          {/* 脈波: 明るいピンクの光 */}
          <linearGradient id={ecgGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFB8CC" />
            <stop offset="50%" stopColor="#FF5C8A" />
            <stop offset="100%" stopColor="#FFB8CC" />
          </linearGradient>
          {/* 淡いグロー (にじむ光) */}
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ハート輪郭 — 一筆書き風のひらいた曲線 (下の頂点から両翼へ) */}
        <path
          d="M50 84
             C 34 72, 16 58, 14 42
             C 12.5 29, 21 19.5, 32 19.5
             C 41 19.5, 47 25.5, 50 32.5
             C 53 25.5, 59 19.5, 68 19.5
             C 79 19.5, 87.5 29, 86 42
             C 84 58, 66 72, 50 84 Z"
          stroke={isMono ? 'currentColor' : `url(#${gradId})`}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={isMono ? undefined : `url(#${glowId})`}
          opacity={isMono ? 0.9 : 1}
        />

        {/* 脈波 (心拍ライン) — ハートの中を流れる鼓動 */}
        <path
          d="M27 51 h11 l5.5 -11 8 22 6 -16 3.5 5 h12"
          stroke={isMono ? 'currentColor' : `url(#${ecgGradId})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={isMono ? undefined : `url(#${glowId})`}
        />

        {/* 鼓動の光点 */}
        {!isMono && <circle cx="73" cy="51" r="2.6" fill="#FFD3E0" filter={`url(#${glowId})`} />}
      </svg>

      {withWordmark && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", serif',
              fontWeight: 600,
              fontSize: size * 0.42,
              letterSpacing: '0.3em',
              ...(isMono ? { color: 'currentColor' } : { color: '#E8859E' }),
            }}
          >
            CORE
          </span>
          <span
            style={{
              fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", serif',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: size * 0.58,
              letterSpacing: '0.04em',
              marginTop: 2,
              ...(isMono ? { color: 'currentColor' } : {
                background: 'linear-gradient(120deg, #FF5C8A 0%, #E8859E 55%, #C9A192 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }),
            }}
          >
            Pulse
          </span>
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
//  CORE — 法人ロゴ (同心円 + 8 本スポーク + 中央の核)
//  「核」の本質: 中心から世界へ放射する光
//  青白いシアン基調の発光、Apple Vision/SF 的な精緻さ
// ─────────────────────────────────────────────
export function CoreLogo({ size = 32, withWordmark = true, variant = 'default', className }: LogoProps) {
  const isMono = variant === 'mono';
  const filterId = `coreGlow-${size}`;
  const gradId = `coreGrad-${size}`;
  const coreGradId = `coreCenter-${size}`;
  const haloId = `coreHalo-${size}`;

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
        aria-label="CORE"
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
          <radialGradient id={coreGradId} cx="50%" cy="38%" r="62%">
            <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="42%" stopColor="#E0F2FE" stopOpacity="1" />
            <stop offset="72%" stopColor="#7DD3FC" stopOpacity="1" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="1" />
          </radialGradient>
          {/* 外周ハロー: 中心から滲む光 */}
          <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#38BDF8" stopOpacity="0.55" />
            <stop offset="55%"  stopColor="#38BDF8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
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

        {/* 中心から滲むハロー (やわらかな発光) */}
        {!isMono && <circle cx="50" cy="50" r="46" fill={`url(#${haloId})`} />}

        {/* 核を囲む 2 つの傾いた軌道 (的ではなく、核を巡る光) */}
        <g
          stroke={isMono ? 'currentColor' : `url(#${gradId})`}
          fill="none"
          filter={isMono ? undefined : `url(#${filterId})`}
          opacity={isMono ? 0.9 : 1}
        >
          <ellipse cx="50" cy="50" rx="41" ry="15.5" strokeWidth="2.6" transform="rotate(-24 50 50)" />
          <ellipse cx="50" cy="50" rx="41" ry="15.5" strokeWidth="2.2" transform="rotate(34 50 50)" opacity={isMono ? 0.6 : 0.5} />
        </g>

        {/* 軌道上を巡る光点 */}
        {!isMono && (
          <g filter={`url(#${filterId})`}>
            <circle cx="86.5" cy="33.3" r="2.8" fill="#E0F2FE" />
            <circle cx="15.6" cy="27.7" r="2.4" fill="#7DD3FC" opacity="0.9" />
          </g>
        )}

        {/* 中央の核 (発光する球) — 主役 */}
        <circle
          cx="50" cy="50" r="13"
          fill={isMono ? 'currentColor' : `url(#${coreGradId})`}
          opacity={isMono ? 0.95 : 1}
          filter={isMono ? undefined : `url(#${filterId})`}
        />
        {/* ハイライト */}
        {!isMono && (
          <circle cx="46" cy="46" r="3.4" fill="#FFFFFF" opacity="0.9" />
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
