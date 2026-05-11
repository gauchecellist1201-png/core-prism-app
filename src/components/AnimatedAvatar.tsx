// ============================================================
// AnimatedAvatar — AI ペルソナの SVG アバター (lipsync + まばたき + mood)
// isSpeaking 中は口が 60-100ms 間隔でランダム開閉 (lipsync 風)
// 4-6 秒ごとに 200ms まばたき、mood で眉の位置が変わる
// ============================================================
import { useEffect, useId, useRef, useState } from 'react';

export type AvatarMood = 'neutral' | 'thinking' | 'happy' | 'curious';

interface Props {
  brand: 'prism' | 'iris';
  accentColor: string;
  isSpeaking: boolean;
  mood?: AvatarMood;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Eyebrow coordinates per mood
const EYEBROWS: Record<AvatarMood, [number, number, number, number, number, number, number, number]> = {
  // [lx1, ly1, lx2, ly2, rx1, ry1, rx2, ry2]
  neutral:  [33, 37, 43, 35, 57, 35, 67, 37],
  thinking: [33, 35, 43, 38, 57, 38, 67, 35],
  happy:    [33, 34, 43, 32, 57, 32, 67, 34],
  curious:  [33, 31, 43, 30, 57, 30, 67, 31],
};

function computeMouthPath(openLevel: number, mood: AvatarMood, isSpeaking: boolean): string {
  if (isSpeaking && openLevel > 0.08) {
    const yMid = 60;
    const spread = openLevel * 9;
    return `M 37 ${yMid} Q 50 ${yMid - spread * 0.25} 63 ${yMid} Q 50 ${yMid + spread * 0.85} 37 ${yMid} Z`;
  }
  if (mood === 'happy' && !isSpeaking) {
    return 'M 37 58 Q 50 67 63 58';
  }
  if (mood === 'thinking') {
    return 'M 39 60 Q 50 60 61 60';
  }
  // neutral / curious / speaking-closed
  return 'M 37 60 Q 50 63 63 60';
}

export default function AnimatedAvatar({
  brand,
  accentColor,
  isSpeaking,
  mood = 'neutral',
  size = 220,
  className,
  style,
}: Props) {
  const [mouthOpen, setMouthOpen] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const speakingRef = useRef(isSpeaking);
  speakingRef.current = isSpeaking;

  // Unique IDs for SVG defs (multiple instances on page)
  const rawId = useId().replace(/:/g, '');
  const filterId = `av-glow-${rawId}`;
  const bgGradId = `av-bg-${rawId}`;
  const ringGradId = `av-ring-${rawId}`;

  // Lipsync: update mouth openness every 60-100 ms while speaking
  useEffect(() => {
    if (!isSpeaking) {
      setMouthOpen(0);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!speakingRef.current) return;
      setMouthOpen(Math.random() * 0.9 + 0.1);
      timer = setTimeout(tick, 60 + Math.random() * 40);
    };
    timer = setTimeout(tick, 60);
    return () => clearTimeout(timer);
  }, [isSpeaking]);

  // Blink: every 4-6 s, close eyes for 200 ms
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      timer = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 200);
      }, 4000 + Math.random() * 2000);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, []);

  const eb = EYEBROWS[mood];
  const mouthPath = computeMouthPath(mouthOpen, mood, isSpeaking);
  const eyeScale = isBlinking ? 0.1 : 1;
  const eyeTransition = `transform ${isBlinking ? '0.06s' : '0.14s'} ease`;
  const isMouthFilled = isSpeaking && mouthOpen > 0.2;

  // Subtle happy glow pulse on logo stroke when happy
  const ringOpacity = mood === 'happy' ? 0.95 : 0.65;

  return (
    <div className={className} style={{ width: size, height: size, flexShrink: 0, ...style }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={brand === 'iris' ? 'アイリス' : 'プリズム'}
      >
        <defs>
          {/* Radial background gradient */}
          <radialGradient id={bgGradId} cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.9" />
            <stop offset="55%" stopColor={accentColor} stopOpacity="0.45" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.12" />
          </radialGradient>
          {/* Ring gradient */}
          <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.3" />
          </linearGradient>
          {/* Glow filter */}
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer glow ring */}
        <circle
          cx="50" cy="50" r="47"
          stroke={`url(#${ringGradId})`}
          strokeWidth="1.8"
          strokeOpacity={ringOpacity}
          filter={`url(#${filterId})`}
        />

        {/* Background fill */}
        <circle cx="50" cy="50" r="45" fill={`url(#${bgGradId})`} />

        {/* Inner dark face area */}
        <circle cx="50" cy="50" r="37" fill="rgba(5,5,18,0.45)" />

        {/* ── Brand mark (upper face area) ── */}
        {brand === 'prism' ? (
          // Mini prism triangle — ポリゴン 3 面
          <g filter={`url(#${filterId})`}>
            <polygon points="50,10 41,24 59,24" fill="rgba(255,255,255,0.82)" />
            <polygon points="41,24 50,24 44,24" fill="rgba(255,255,255,0.4)" />
          </g>
        ) : (
          // Mini iris petals (2-petal simplified)
          <g
            stroke="rgba(255,255,255,0.82)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            filter={`url(#${filterId})`}
          >
            <path d="M 50 9 C 46 14, 46 20, 50 25 C 54 20, 54 14, 50 9 Z" />
            <path d="M 43 17 C 46 17, 52 17, 57 17" strokeWidth="1.2" strokeOpacity="0.5" />
          </g>
        )}

        {/* ── Eyebrows ── */}
        <g
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <line x1={eb[0]} y1={eb[1]} x2={eb[2]} y2={eb[3]} />
          <line x1={eb[4]} y1={eb[5]} x2={eb[6]} y2={eb[7]} />
        </g>

        {/* ── Left eye ── */}
        <g style={{ transform: `scaleY(${eyeScale})`, transformOrigin: '38px 44px', transition: eyeTransition }}>
          <ellipse cx="38" cy="44" rx="5.5" ry="5" fill="rgba(255,255,255,0.93)" />
          <ellipse cx="39" cy="44" rx="2.6" ry="2.6" fill="#110e1f" />
          <circle  cx="40" cy="42.5" r="1.1" fill="rgba(255,255,255,0.88)" />
        </g>

        {/* ── Right eye ── */}
        <g style={{ transform: `scaleY(${eyeScale})`, transformOrigin: '62px 44px', transition: eyeTransition }}>
          <ellipse cx="62" cy="44" rx="5.5" ry="5" fill="rgba(255,255,255,0.93)" />
          <ellipse cx="63" cy="44" rx="2.6" ry="2.6" fill="#110e1f" />
          <circle  cx="64" cy="42.5" r="1.1" fill="rgba(255,255,255,0.88)" />
        </g>

        {/* ── Nose (subtle dots) ── */}
        <circle cx="48.5" cy="53.5" r="0.9" fill="rgba(255,255,255,0.28)" />
        <circle cx="51.5" cy="53.5" r="0.9" fill="rgba(255,255,255,0.28)" />

        {/* ── Mouth ── */}
        <path
          d={mouthPath}
          stroke="rgba(255,255,255,0.88)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={isMouthFilled ? 'rgba(10,6,28,0.9)' : 'none'}
        />
      </svg>
    </div>
  );
}
