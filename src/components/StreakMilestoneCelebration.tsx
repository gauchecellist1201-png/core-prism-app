// ============================================================
// StreakMilestoneCelebration — 連続日数の節目で全画面 cinematic 祝祭
// 3 / 7 / 30 / 100 / 365 日に発火、約 6 秒の演出後に自動 close
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Sparkles, Trophy, Crown } from 'lucide-react';

interface Props {
  streak: number;
  brand: 'prism' | 'iris';
  accent: string;
  onClose: () => void;
}

interface MilestoneCopy {
  title: string;
  subtitle: string;
  caption: string;
  icon: React.ReactElement;
  duration: number; // ms before auto-close
}

function getCopy(streak: number, brand: 'prism' | 'iris'): MilestoneCopy {
  const irisOrPrism = brand === 'iris' ? '光' : '核';
  switch (streak) {
    case 3:
      return {
        title: '3 日連続',
        subtitle: 'リズムが、できはじめた',
        caption: `毎日 ${irisOrPrism}に触れる ─ それだけで人は変わります`,
        icon: <Flame size={64} fill="#fff" />,
        duration: 5500,
      };
    case 7:
      return {
        title: '7 日連続',
        subtitle: '一週間、続けられた',
        caption: 'ここで踏み止まる人は、3% もいません。あなたはそこに入りました。',
        icon: <Sparkles size={64} strokeWidth={1.5} />,
        duration: 6500,
      };
    case 30:
      return {
        title: '30 日連続',
        subtitle: '一ヶ月、欠かさなかった',
        caption: 'これは「習慣」です。もう CORE はあなたの一部です。',
        icon: <Trophy size={64} strokeWidth={1.5} />,
        duration: 7500,
      };
    case 100:
      return {
        title: '100 日連続',
        subtitle: 'もう、止まらない',
        caption: '100 日続けた人だけが見える景色があります。\nここから先、あなたの軌跡は誰にも追えません。',
        icon: <Crown size={64} strokeWidth={1.5} />,
        duration: 8500,
      };
    case 365:
      return {
        title: '365 日連続',
        subtitle: '一年、途切れなかった',
        caption: 'これは奇跡です。\nあなたが歩いた 365 日は、あなただけの永遠の財産。',
        icon: <Crown size={72} strokeWidth={1.5} />,
        duration: 10000,
      };
    default:
      return {
        title: `${streak} 日連続`,
        subtitle: '今日も、ここに来てくれた',
        caption: '小さな一歩が、大きな道になる',
        icon: <Flame size={64} fill="#fff" />,
        duration: 5000,
      };
  }
}

/** 花火パーティクル — 中心から放射状に飛ぶ */
function Fireworks({ brand }: { accent: string; brand: 'prism' | 'iris' }) {
  // ブランドのカラーパレットで複数色の花火
  const palette = brand === 'iris'
    ? ['#E1306C', '#FCB045', '#833AB4', '#FD7CB8', '#FFFFFF', '#FBBF24']
    : ['#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#F472B6', '#FFFFFF', '#FB923C'];

  const sparks = useMemo(() => Array.from({ length: 120 }).map((_, i) => {
    const angle = (i / 120) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 200 + Math.random() * 380;
    return {
      angle, distance,
      delay: Math.random() * 0.8,
      duration: 1.4 + Math.random() * 1.4,
      size: 4 + Math.random() * 6,
      color: palette[i % palette.length],
    };
  }), [palette]);

  // 2 つ目の花火、別の中心から
  const sparks2 = useMemo(() => Array.from({ length: 80 }).map((_, i) => {
    const angle = (i / 80) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 160 + Math.random() * 320;
    return {
      angle, distance,
      delay: 0.8 + Math.random() * 0.6,
      duration: 1.4 + Math.random() * 1.4,
      size: 3 + Math.random() * 5,
      color: palette[(i + 3) % palette.length],
    };
  }), [palette]);

  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, pointerEvents: 'none',
      overflow: 'hidden', zIndex: 1,
    }}>
      {/* 中央花火 */}
      <div style={{ position: 'absolute', left: '50%', top: '40%' }}>
        {sparks.map((s, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
            animate={{
              x: Math.cos(s.angle) * s.distance,
              y: Math.sin(s.angle) * s.distance + 100 /* 重力風 */,
              opacity: [1, 1, 0],
              scale: [0.5, 1.1, 0.6],
            }}
            transition={{
              duration: s.duration, delay: s.delay,
              ease: [0.2, 0.6, 0.4, 1],
            }}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size,
              background: s.color, borderRadius: '50%',
              boxShadow: `0 0 12px ${s.color}, 0 0 24px ${s.color}88`,
            }}
          />
        ))}
      </div>
      {/* 左下花火 */}
      <div style={{ position: 'absolute', left: '22%', top: '55%' }}>
        {sparks2.map((s, i) => (
          <motion.div
            key={`b${i}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
            animate={{
              x: Math.cos(s.angle) * s.distance,
              y: Math.sin(s.angle) * s.distance + 90,
              opacity: [1, 1, 0],
              scale: [0.5, 1, 0.6],
            }}
            transition={{
              duration: s.duration, delay: s.delay,
              ease: [0.2, 0.6, 0.4, 1],
            }}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size,
              background: s.color, borderRadius: '50%',
              boxShadow: `0 0 10px ${s.color}, 0 0 20px ${s.color}77`,
            }}
          />
        ))}
      </div>
      {/* 右上花火 (遅延) */}
      <div style={{ position: 'absolute', left: '76%', top: '32%' }}>
        {sparks2.map((s, i) => (
          <motion.div
            key={`c${i}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
            animate={{
              x: Math.cos(s.angle) * s.distance,
              y: Math.sin(s.angle) * s.distance + 90,
              opacity: [1, 1, 0],
              scale: [0.5, 1, 0.6],
            }}
            transition={{
              duration: s.duration, delay: s.delay + 1.2,
              ease: [0.2, 0.6, 0.4, 1],
            }}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size,
              background: s.color, borderRadius: '50%',
              boxShadow: `0 0 10px ${s.color}, 0 0 20px ${s.color}77`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function StreakMilestoneCelebration({ streak, brand, accent, onClose }: Props) {
  const copy = getCopy(streak, brand);
  const [closing, setClosing] = useState(false);

  // 自動 close (タップでスキップ可能)
  useEffect(() => {
    const t = window.setTimeout(() => setClosing(true), copy.duration);
    return () => window.clearTimeout(t);
  }, [copy.duration]);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(onClose, 600);
    return () => window.clearTimeout(t);
  }, [closing, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: 0.6 }}
      onClick={() => setClosing(true)}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: brand === 'iris'
          ? 'radial-gradient(circle at 50% 40%, rgba(80, 12, 60, 0.95), rgba(10, 4, 16, 0.98))'
          : 'radial-gradient(circle at 50% 40%, rgba(40, 10, 90, 0.95), rgba(6, 6, 16, 0.98))',
        backdropFilter: 'blur(24px)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* 背景の脈動グラデーション */}
      <motion.div
        aria-hidden
        animate={{
          background: [
            `radial-gradient(circle at 30% 30%, ${accent}44 0%, transparent 50%)`,
            `radial-gradient(circle at 70% 50%, ${accent}55 0%, transparent 55%)`,
            `radial-gradient(circle at 40% 70%, ${accent}44 0%, transparent 50%)`,
          ],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />

      <Fireworks accent={accent} brand={brand} />

      <div style={{
        position: 'relative', zIndex: 2,
        height: '100%', width: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem', textAlign: 'center',
      }}>
        {/* アイコン */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: [0, 1.3, 1], rotate: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.2, 1.4, 0.6, 1] }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 140, height: 140, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent} 0%, ${accent}cc 50%, transparent 90%)`,
            color: '#fff',
            boxShadow: `0 0 80px ${accent}aa, 0 0 160px ${accent}66`,
            marginBottom: 28,
          }}
        >
          {copy.icon}
        </motion.div>

        {/* タイトル — 大きな数字 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{
            fontSize: 'clamp(3rem, 9vw, 6rem)',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            background: `linear-gradient(135deg, #fff 0%, ${accent} 60%, #fff 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 12,
          }}
        >
          {copy.title}
        </motion.div>

        {/* サブタイトル */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          style={{
            fontSize: 'clamp(1.2rem, 3.5vw, 1.8rem)',
            fontWeight: 800,
            color: 'rgba(255,255,255,0.95)',
            marginBottom: 20,
            letterSpacing: '0.04em',
          }}
        >
          {copy.subtitle}
        </motion.div>

        {/* キャプション */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          style={{
            fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.85,
            maxWidth: 620,
            whiteSpace: 'pre-line',
            marginBottom: 32,
          }}
        >
          {copy.caption}
        </motion.p>

        {/* スキップ案内 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.6] }}
          transition={{ delay: 2.5, duration: 1.5 }}
          style={{
            position: 'absolute', bottom: '8%',
            fontSize: 11, color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}
        >
          タップで閉じる
        </motion.div>
      </div>
    </motion.div>
  );
}
