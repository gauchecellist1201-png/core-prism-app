// ============================================================
// AnimatedAvatar v2 — 親しみやすい AI 分身マスコット
// 大きな丸い目 + キラキラハイライト + チーク + 笑顔ベース
// isSpeaking 中は口がふんわり動く / まばたき 4-6s / mood で表情変化
// brand: prism = ライラックブルー系 / iris = ピーチピンク系
// ============================================================
import { useEffect, useId, useRef, useState } from 'react';

export type AvatarMood = 'neutral' | 'thinking' | 'happy' | 'curious';

interface Props {
  brand: 'prism' | 'iris';
  /** 互換のため受け取るが、内部のキャラ色は brand から自動決定 */
  accentColor?: string;
  isSpeaking: boolean;
  mood?: AvatarMood;
  /** 既定 240。「分身」を見せるシーンでは 360-480 推奨 */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** 名前ラベルを下に出す (任意) */
  name?: string;
}

// 表情パラメータ (mouth shape, blush opacity, eye sparkle scale, brow tilt)
type Expression = {
  mouth: string;        // d 属性
  mouthFill: string;
  blush: number;        // 0-1
  sparkle: number;      // 0-1
  browTilt: number;     // -1 ~ 1
};

function speakingMouth(open: number): Expression {
  // やわらかいオーバル「あ・い・う・え」っぽい
  const cy = 70;
  const w = 6 + open * 5;
  const h = 2 + open * 5;
  return {
    mouth: `M ${50 - w} ${cy} Q 50 ${cy + h} ${50 + w} ${cy} Q 50 ${cy - h * 0.5} ${50 - w} ${cy}`,
    mouthFill: '#9C3A5C',
    blush: 0.55,
    sparkle: 1,
    browTilt: -0.1,
  };
}

function expressionForMood(mood: AvatarMood): Expression {
  switch (mood) {
    case 'happy':
      return {
        mouth: 'M 38 67 Q 50 78 62 67',
        mouthFill: 'transparent',
        blush: 0.85, sparkle: 1, browTilt: 0.4,
      };
    case 'thinking':
      return {
        mouth: 'M 42 70 Q 48 67 54 70',
        mouthFill: 'transparent',
        blush: 0.25, sparkle: 0.5, browTilt: -0.5,
      };
    case 'curious':
      return {
        mouth: 'M 44 69 Q 50 73 56 69',
        mouthFill: 'transparent',
        blush: 0.5, sparkle: 0.9, browTilt: 0.6,
      };
    default: // neutral
      return {
        mouth: 'M 41 69 Q 50 74 59 69',
        mouthFill: 'transparent',
        blush: 0.45, sparkle: 0.8, browTilt: 0.1,
      };
  }
}

const PALETTE = {
  prism: {
    bg1: '#E8EBFF', bg2: '#C8D5FF', bg3: '#A0B5FF',
    skin: '#FFE9E0', skinShade: '#F8D5C7',
    hair: '#5A6BD8',
    accent: '#7A8AFF',
    blush: '#FFB6C8',
    eyeIris: '#3D4FB5',
    sparkle: '#FFFFFF',
    glow: '#A0B5FF',
  },
  iris: {
    bg1: '#FFF0F5', bg2: '#FFD4E5', bg3: '#FFB6C8',
    skin: '#FFE4D9', skinShade: '#F5C9B8',
    hair: '#E1306C',
    accent: '#FF6FA9',
    blush: '#FF95B5',
    eyeIris: '#B23A6E',
    sparkle: '#FFFFFF',
    glow: '#FFB6D5',
  },
} as const;

export default function AnimatedAvatar({
  brand,
  isSpeaking,
  mood = 'neutral',
  size = 240,
  className,
  style,
  name,
}: Props) {
  const [mouthOpen, setMouthOpen] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const speakingRef = useRef(isSpeaking);
  speakingRef.current = isSpeaking;

  const rawId = useId().replace(/:/g, '');
  const bgGradId = `mas-bg-${rawId}`;
  const skinGradId = `mas-skin-${rawId}`;
  const hairGradId = `mas-hair-${rawId}`;
  const irisGradId = `mas-iris-${rawId}`;
  const haloGradId = `mas-halo-${rawId}`;

  const c = PALETTE[brand];

  useEffect(() => {
    if (!isSpeaking) { setMouthOpen(0); return; }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!speakingRef.current) return;
      setMouthOpen(Math.random() * 0.85 + 0.15);
      timer = setTimeout(tick, 90 + Math.random() * 70);
    };
    timer = setTimeout(tick, 80);
    return () => clearTimeout(timer);
  }, [isSpeaking]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      timer = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 160);
      }, 3500 + Math.random() * 2500);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, []);

  const expr = isSpeaking ? speakingMouth(mouthOpen) : expressionForMood(mood);
  const eyeScaleY = isBlinking ? 0.08 : 1;
  const eyeTransition = `transform ${isBlinking ? '0.06s' : '0.13s'} ease`;

  // 眉の傾き (-1 sad → +1 happy) — y 座標で表現
  const browLY1 = 36 - expr.browTilt * 1.5;
  const browLY2 = 36 + expr.browTilt * 1.0;
  const browRY1 = 36 + expr.browTilt * 1.0;
  const browRY2 = 36 - expr.browTilt * 1.5;

  return (
    <div
      className={className}
      style={{
        width: size, height: name ? size + 28 : size,
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label={brand === 'iris' ? 'アイリス' : 'プリズム'}>
        <defs>
          <radialGradient id={bgGradId} cx="50%" cy="48%" r="58%">
            <stop offset="0%" stopColor={c.bg1} />
            <stop offset="60%" stopColor={c.bg2} />
            <stop offset="100%" stopColor={c.bg3} />
          </radialGradient>
          <radialGradient id={haloGradId} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={c.glow} stopOpacity="0" />
            <stop offset="60%" stopColor={c.glow} stopOpacity="0.35" />
            <stop offset="100%" stopColor={c.glow} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={skinGradId} cx="42%" cy="40%" r="62%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="40%" stopColor={c.skin} />
            <stop offset="100%" stopColor={c.skinShade} />
          </radialGradient>
          <linearGradient id={hairGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={c.hair} />
            <stop offset="100%" stopColor={c.accent} />
          </linearGradient>
          <radialGradient id={irisGradId} cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor={c.accent} />
            <stop offset="60%" stopColor={c.eyeIris} />
            <stop offset="100%" stopColor="#1A0E2E" />
          </radialGradient>
        </defs>

        {/* ふんわり光るハロー (背景) */}
        <circle cx="50" cy="50" r="48" fill={`url(#${haloGradId})`} />

        {/* 背景円 */}
        <circle cx="50" cy="50" r="44" fill={`url(#${bgGradId})`} />

        {/* 髪 (頭の後ろ) — ふわっとしたアウトライン */}
        <path
          d="M 22 42 Q 18 28 30 18 Q 50 6 70 18 Q 82 28 78 42 Q 80 52 73 56 L 73 50 Q 71 38 50 32 Q 29 38 27 50 L 27 56 Q 20 52 22 42 Z"
          fill={`url(#${hairGradId})`}
        />

        {/* 顔 (肌) */}
        <ellipse cx="50" cy="55" rx="22" ry="24" fill={`url(#${skinGradId})`} />

        {/* チーク (頬の赤み) */}
        <ellipse cx="34" cy="60" rx="5.5" ry="3" fill={c.blush} opacity={expr.blush} />
        <ellipse cx="66" cy="60" rx="5.5" ry="3" fill={c.blush} opacity={expr.blush} />

        {/* 眉 */}
        <g stroke={c.hair} strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d={`M 32 ${browLY1} Q 37 ${browLY1 - 0.5} 41 ${browLY2}`} />
          <path d={`M 59 ${browRY1} Q 63 ${browRY1 - 0.5} 68 ${browRY2}`} />
        </g>

        {/* 左目 */}
        <g style={{ transform: `scaleY(${eyeScaleY})`, transformOrigin: '37px 47px', transition: eyeTransition }}>
          {/* 白目 */}
          <ellipse cx="37" cy="47" rx="5.2" ry="6.2" fill="#FFFFFF" />
          {/* 虹彩 */}
          <ellipse cx="37.5" cy="47.5" rx="3.3" ry="4.0" fill={`url(#${irisGradId})`} />
          {/* 瞳孔 */}
          <ellipse cx="37.6" cy="48" rx="1.4" ry="1.7" fill="#0E0824" />
          {/* キラキラ大ハイライト */}
          <ellipse cx="36.0" cy="45.6" rx={1.6 * expr.sparkle} ry={2.0 * expr.sparkle} fill="#FFFFFF" />
          {/* 小さい光 */}
          <circle cx="38.7" cy="49.0" r={0.55 * expr.sparkle} fill="#FFFFFF" />
        </g>

        {/* 右目 */}
        <g style={{ transform: `scaleY(${eyeScaleY})`, transformOrigin: '63px 47px', transition: eyeTransition }}>
          <ellipse cx="63" cy="47" rx="5.2" ry="6.2" fill="#FFFFFF" />
          <ellipse cx="63.5" cy="47.5" rx="3.3" ry="4.0" fill={`url(#${irisGradId})`} />
          <ellipse cx="63.6" cy="48" rx="1.4" ry="1.7" fill="#0E0824" />
          <ellipse cx="62.0" cy="45.6" rx={1.6 * expr.sparkle} ry={2.0 * expr.sparkle} fill="#FFFFFF" />
          <circle cx="64.7" cy="49.0" r={0.55 * expr.sparkle} fill="#FFFFFF" />
        </g>

        {/* 鼻 (極小、控えめ) */}
        <ellipse cx="50" cy="61" rx="0.9" ry="0.5" fill={c.skinShade} opacity="0.6" />

        {/* 口 */}
        <path
          d={expr.mouth}
          stroke={brand === 'iris' ? '#9C3A5C' : '#5A4A8A'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={expr.mouthFill}
        />

        {/* ブランドマーク (頭の上、控えめなアクセサリー) */}
        {brand === 'iris' ? (
          // 小さい花
          <g transform="translate(50 16)">
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <ellipse key={i} cx="0" cy="-3" rx="1.6" ry="3.2"
                fill={c.accent}
                transform={`rotate(${deg})`}
                opacity="0.85" />
            ))}
            <circle cx="0" cy="0" r="1.4" fill="#FFE4D9" />
          </g>
        ) : (
          // 小さい星
          <g transform="translate(50 16)">
            <path
              d="M 0 -4 L 1.2 -1.2 L 4 -1 L 1.6 1.0 L 2.4 4 L 0 2.2 L -2.4 4 L -1.6 1.0 L -4 -1 L -1.2 -1.2 Z"
              fill={c.accent}
            />
          </g>
        )}
      </svg>
      {name && (
        <div style={{
          marginTop: 6,
          fontSize: Math.max(11, size * 0.06),
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: c.hair,
          fontFamily: '"Inter","Noto Sans JP",sans-serif',
        }}>
          {name}
        </div>
      )}
    </div>
  );
}
