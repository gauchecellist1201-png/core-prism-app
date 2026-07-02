// ============================================================
// ConciergeAvatar — 「美形コンシェルジュ」の Living Portrait
//
// 写真もイラスト顔も使わず、上品な抽象シルエット (胸像) + 分光ハローで
// 「高級ホテルのロビーにいる存在感」を出す。
// 状態アニメ:
//   idle      = ゆったり呼吸 (約1.2% スケール)
//   listening = ハローが静かに収縮し、耳を傾ける
//   thinking  = GenerationOrb 風にハローが回転
//   speaking  = 外周リングが声のように脈動
//
// avatarProvider は将来 HeyGen / D-ID の実写風アバターへ差し替えるための
// 予約席。'portrait' 以外は未接続なので、silent fail せず「準備中」を明示する。
// ============================================================
import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ConciergeState } from './useConcierge';

export type AvatarProvider = 'portrait' | 'heygen' | 'did';

interface Props {
  state: ConciergeState;
  size?: number;
  /** アクセント色 (金 #C9A96E など) */
  accent?: string;
  avatarProvider?: AvatarProvider;
}

export default function ConciergeAvatar({ state, size = 56, accent = '#C9A96E', avatarProvider = 'portrait' }: Props) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `cg_${uid}`;
  const faceId = `cf_${uid}`;

  // ── 未接続プロバイダ: 隠さず「準備中」を明示 ──────────
  if (avatarProvider !== 'portrait') {
    return (
      <div
        style={{
          position: 'relative', width: size, height: size, borderRadius: '50%',
          background: 'linear-gradient(160deg, #14182B, #0A0C16)',
          border: `1px solid ${accent}55`,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
        aria-label="実写風アバターは準備中"
      >
        <span style={{ fontSize: Math.max(8, size * 0.16), fontWeight: 700, color: accent, letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.3 }}>
          準備中
        </span>
      </div>
    );
  }

  const halo = `conic-gradient(from 0deg, ${accent}00, ${accent}88, #F3E3BC, ${accent}00 62%, ${accent}44, ${accent}00)`;
  const ring = Math.max(1.5, size * 0.03);

  // 状態ごとの本体アニメ (呼吸 / 静止)
  const bodyAnim = reduce
    ? {}
    : state === 'idle'
      ? { animate: { scale: [1, 1.012, 1] }, transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const } }
      : state === 'listening'
        ? { animate: { scale: 0.985 }, transition: { type: 'spring' as const, stiffness: 200, damping: 26 } }
        : { animate: { scale: 1 }, transition: { duration: 0.3 } };

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden>
      {/* 分光ハロー: thinking で回転、listening で収縮、他はごく淡く漂う */}
      {!reduce && (
        <motion.div
          animate={
            state === 'thinking'
              ? { rotate: 360, scale: 1.06, opacity: 0.95 }
              : state === 'listening'
                ? { rotate: 0, scale: 0.9, opacity: 0.85 }
                : state === 'speaking'
                  ? { rotate: 0, scale: 1.04, opacity: 0.9 }
                  : { rotate: 0, scale: 1, opacity: 0.55 }
          }
          transition={
            state === 'thinking'
              ? { rotate: { duration: 2.6, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.4 }, opacity: { duration: 0.4 } }
              : { type: 'spring', stiffness: 180, damping: 24 }
          }
          style={{
            position: 'absolute', inset: -ring * 2, borderRadius: '50%',
            background: halo,
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${ring * 2.4}px), #000 calc(100% - ${ring * 2.4}px))`,
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${ring * 2.4}px), #000 calc(100% - ${ring * 2.4}px))`,
            filter: `drop-shadow(0 0 ${size * 0.12}px ${accent}66)`,
          }}
        />
      )}

      {/* speaking: 声の脈動リング (2 本が交互に広がって消える) */}
      {!reduce && state === 'speaking' && [0, 1].map(i => (
        <motion.div
          key={i}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.45, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `1px solid ${accent}`,
          }}
        />
      ))}

      {/* 本体メダリオン: 深いネイビー地 + 金縁 + 抽象胸像 */}
      <motion.div
        {...bodyAnim}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          overflow: 'hidden',
          background: 'radial-gradient(120% 120% at 30% 20%, #1C2240 0%, #0D101F 58%, #070812 100%)',
          border: `1px solid ${accent}66`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(0,0,0,0.45)`,
        }}
      >
        <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="コンシェルジュ">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F3E3BC" />
              <stop offset="55%" stopColor={accent} />
              <stop offset="100%" stopColor="#8A6B34" />
            </linearGradient>
            <radialGradient id={faceId} cx="0.38" cy="0.3" r="0.9">
              <stop offset="0%" stopColor="#FFF6E0" stopOpacity="0.95" />
              <stop offset="60%" stopColor={accent} />
              <stop offset="100%" stopColor="#7A5C2C" />
            </radialGradient>
          </defs>
          {/* 背景の淡い光 (ロビーの照明) */}
          <ellipse cx="50" cy="30" rx="34" ry="26" fill={accent} opacity="0.10" />
          {/* 頭部: 柔らかい輪郭のフェイスシルエット */}
          <ellipse cx="50" cy="38.5" rx="15.5" ry="17.5" fill={`url(#${faceId})`} />
          {/* 首すじ */}
          <path d="M44 53 C 45 58, 55 58, 56 53 L 56 60 L 44 60 Z" fill={`url(#${gradId})`} opacity="0.92" />
          {/* 肩: 端正な立ち姿 (胸像) */}
          <path d="M18 100 C 24 74, 38 66, 50 66 C 62 66, 76 74, 82 100 Z" fill={`url(#${gradId})`} />
          {/* 襟元の V ライン (フォーマルの記号) */}
          <path d="M50 66 L 44 78 L 50 92 L 56 78 Z" fill="#0D101F" opacity="0.55" />
          {/* 頬の光 — 表情ではなく「灯り」で品を出す */}
          <ellipse cx="44" cy="32" rx="5.5" ry="7" fill="#FFFFFF" opacity="0.18" />
        </svg>
      </motion.div>
    </div>
  );
}
