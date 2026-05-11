// ============================================================
// AnimatedAvatar v3 — 親しみやすい「精霊マスコット」
// 人間顔ではなく、丸いオーブ (オーラ + 大きな瞳 + ニッコリ口)
// brand: prism = ライラックブルー / iris = ピーチピンク
// isSpeaking で口がパクパク、4-6s でまばたき、mood で表情変化
// ============================================================
import { useEffect, useId, useRef, useState } from 'react';

export type AvatarMood = 'neutral' | 'thinking' | 'happy' | 'curious';

interface Props {
  brand: 'prism' | 'iris';
  /** 互換のため受け取るが、内部色は brand から自動 */
  accentColor?: string;
  isSpeaking: boolean;
  mood?: AvatarMood;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  name?: string;
}

const PALETTE = {
  prism: {
    body1: '#A0B5FF',  // 明るいライラック
    body2: '#7A8AFF',
    body3: '#5A6BD8',
    cheek: '#FFB6C8',
    mouth: '#5A6BD8',
    halo:  '#C8D5FF',
    accent: '#FFFFFF',
  },
  iris: {
    body1: '#FFD4E5',  // 明るいピーチピンク
    body2: '#FF9CB5',
    body3: '#E1306C',
    cheek: '#FF6FA9',
    mouth: '#9C3A5C',
    halo:  '#FFE4D9',
    accent: '#FFFFFF',
  },
} as const;

// 表情パラメータ
type Expression = {
  mouthD: string;       // 口の SVG path
  mouthFilled: boolean; // 中を塗るか
  cheek: number;        // 0-1
  brow: number;         // -1 怒り ~ +1 嬉しい (今は飾りで使う)
  bounceDur: number;    // body bounce 周期
};

function speakingMouth(open: number): Expression {
  // 「あ」っぽい楕円
  const w = 5 + open * 6;
  const h = 1.5 + open * 5.5;
  return {
    mouthD: `M 50 ${65} m -${w} 0 a ${w} ${h} 0 1 0 ${w * 2} 0 a ${w} ${h} 0 1 0 -${w * 2} 0`,
    mouthFilled: true,
    cheek: 0.7,
    brow: 0.3,
    bounceDur: 1.6,
  };
}

function expressionForMood(mood: AvatarMood): Expression {
  switch (mood) {
    case 'happy':
      return {
        mouthD: 'M 40 62 Q 50 76 60 62',
        mouthFilled: false,
        cheek: 0.95,
        brow: 0.7,
        bounceDur: 2.4,
      };
    case 'thinking':
      return {
        mouthD: 'M 44 67 Q 50 65 56 67',
        mouthFilled: false,
        cheek: 0.3,
        brow: -0.3,
        bounceDur: 4,
      };
    case 'curious':
      return {
        mouthD: 'M 45 65 Q 50 70 55 65',
        mouthFilled: false,
        cheek: 0.6,
        brow: 0.5,
        bounceDur: 3,
      };
    default:
      return {
        mouthD: 'M 42 64 Q 50 71 58 64',
        mouthFilled: false,
        cheek: 0.55,
        brow: 0.2,
        bounceDur: 3.5,
      };
  }
}

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
  const [bounceY, setBounceY] = useState(0);
  const speakingRef = useRef(isSpeaking);
  speakingRef.current = isSpeaking;

  const rawId = useId().replace(/:/g, '');
  const bodyGradId = `mas3-body-${rawId}`;
  const haloGradId = `mas3-halo-${rawId}`;
  const eyeGradId = `mas3-eye-${rawId}`;
  const shineGradId = `mas3-shine-${rawId}`;

  const c = PALETTE[brand];
  const expr = isSpeaking ? speakingMouth(mouthOpen) : expressionForMood(mood);

  // しゃべる時の口アニメ
  useEffect(() => {
    if (!isSpeaking) { setMouthOpen(0); return; }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!speakingRef.current) return;
      setMouthOpen(Math.random() * 0.85 + 0.15);
      timer = setTimeout(tick, 100 + Math.random() * 90);
    };
    timer = setTimeout(tick, 80);
    return () => clearTimeout(timer);
  }, [isSpeaking]);

  // ふわふわ上下 (常時)
  useEffect(() => {
    let frame: number;
    let start = performance.now();
    const animate = (now: number) => {
      const t = (now - start) / 1000;
      const period = expr.bounceDur;
      const y = Math.sin((t / period) * Math.PI * 2) * 1.5;
      setBounceY(y);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [expr.bounceDur]);

  // まばたき
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      timer = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 130);
      }, 3000 + Math.random() * 2500);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, []);

  const eyeScaleY = isBlinking ? 0.08 : 1;
  const eyeTransition = `transform ${isBlinking ? '0.05s' : '0.12s'} ease`;

  return (
    <div
      className={className}
      style={{
        width: size, height: name ? size + 32 : size,
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label={brand === 'iris' ? 'アイリス' : 'プリズム'}>
        <defs>
          {/* 体のラジアルグラデ (上方が明るい、下方が深い) */}
          <radialGradient id={bodyGradId} cx="42%" cy="35%" r="68%">
            <stop offset="0%" stopColor={c.body1} />
            <stop offset="55%" stopColor={c.body2} />
            <stop offset="100%" stopColor={c.body3} />
          </radialGradient>
          {/* ふわっとしたハロー */}
          <radialGradient id={haloGradId} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={c.halo} stopOpacity="0" />
            <stop offset="55%" stopColor={c.halo} stopOpacity="0.5" />
            <stop offset="100%" stopColor={c.halo} stopOpacity="0" />
          </radialGradient>
          {/* 瞳のラジアル (中心が明るい白) */}
          <radialGradient id={eyeGradId} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor={c.body1} />
            <stop offset="100%" stopColor="#0E0824" />
          </radialGradient>
          {/* 体の上のハイライト (光沢) */}
          <linearGradient id={shineGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ハロー (ふわっと光る背景) */}
        <circle cx="50" cy="50" r="48" fill={`url(#${haloGradId})`} />

        {/* 全体を上下にふわふわ */}
        <g transform={`translate(0 ${bounceY})`}>
          {/* 影 (体の下にぽつんと) */}
          <ellipse cx="50" cy="86" rx="22" ry="3" fill="#000" opacity="0.18" />

          {/* 体 (オーブ) */}
          <circle cx="50" cy="50" r="36" fill={`url(#${bodyGradId})`} />

          {/* 上のハイライト (球体感) */}
          <ellipse cx="42" cy="32" rx="18" ry="14" fill={`url(#${shineGradId})`} />

          {/* チーク */}
          <ellipse cx="32" cy="58" rx="6" ry="3.5" fill={c.cheek} opacity={expr.cheek * 0.8} />
          <ellipse cx="68" cy="58" rx="6" ry="3.5" fill={c.cheek} opacity={expr.cheek * 0.8} />

          {/* 左目 (大きな丸) */}
          <g style={{ transform: `scaleY(${eyeScaleY})`, transformOrigin: '37px 45px', transition: eyeTransition }}>
            <ellipse cx="37" cy="45" rx="6.5" ry="7.5" fill="#0E0824" />
            <ellipse cx="37" cy="45" rx="5.5" ry="6.5" fill={`url(#${eyeGradId})`} />
            {/* 瞳孔 */}
            <ellipse cx="37" cy="46.5" rx="2.2" ry="2.6" fill="#0E0824" />
            {/* 大きな白いハイライト */}
            <ellipse cx="35" cy="42.5" rx="2.4" ry="3.0" fill="#FFFFFF" />
            {/* 小さい光 */}
            <circle cx="39" cy="48" r="0.9" fill="#FFFFFF" />
          </g>

          {/* 右目 */}
          <g style={{ transform: `scaleY(${eyeScaleY})`, transformOrigin: '63px 45px', transition: eyeTransition }}>
            <ellipse cx="63" cy="45" rx="6.5" ry="7.5" fill="#0E0824" />
            <ellipse cx="63" cy="45" rx="5.5" ry="6.5" fill={`url(#${eyeGradId})`} />
            <ellipse cx="63" cy="46.5" rx="2.2" ry="2.6" fill="#0E0824" />
            <ellipse cx="61" cy="42.5" rx="2.4" ry="3.0" fill="#FFFFFF" />
            <circle cx="65" cy="48" r="0.9" fill="#FFFFFF" />
          </g>

          {/* 口 (ニッコリ or パクパク) */}
          <path
            d={expr.mouthD}
            stroke={c.mouth}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={expr.mouthFilled ? c.mouth : 'none'}
          />

          {/* ブランドの小さなアクセサリー (頭の上) */}
          {brand === 'iris' ? (
            // 小さな葉っぱ / 花のつぼみ
            <g transform="translate(50 10)">
              <path d="M 0 0 C -3 -2 -3 -7 0 -10 C 3 -7 3 -2 0 0 Z" fill={c.body3} />
              <circle cx="0" cy="-3" r="1.2" fill="#FFE4D9" opacity="0.9" />
            </g>
          ) : (
            // 小さな星 / クリスタル
            <g transform="translate(50 10)">
              <path
                d="M 0 -10 L 2 -3 L 8 -3 L 3 1 L 5 7 L 0 3 L -5 7 L -3 1 L -8 -3 L -2 -3 Z"
                fill={c.body1}
              />
            </g>
          )}
        </g>
      </svg>
      {name && (
        <div style={{
          marginTop: 8,
          fontSize: Math.max(11, size * 0.055),
          fontWeight: 800,
          letterSpacing: '0.18em',
          color: c.body3,
          fontFamily: '"Inter","Noto Sans JP",sans-serif',
        }}>
          {name}
        </div>
      )}
    </div>
  );
}
