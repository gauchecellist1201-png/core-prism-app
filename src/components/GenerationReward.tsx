import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { playChime } from '../lib/haptic';

/**
 * AI 生成が終わった「その瞬間」を、ふわっとした光と小さな音で祝う演出。
 * 待った数十秒を「待ったかいがあった」で締めるための共通部品。
 * pointer-events: none なので結果画面の操作はさまたげない。
 * 効果音は haptic.ts の共通エンジンに集約 — ローパスで温かみのある三和音。
 */
type Props = {
  accent: string;
  /** 完了後に出すひとこと */
  label?: string;
  /** 小さく出す補足 */
  detail?: string;
  /** やわらかい効果音を鳴らすか (既定 true) */
  sound?: boolean;
  onDone?: () => void;
};

export default function GenerationReward({
  accent,
  label = 'できました！',
  detail,
  sound = true,
  onDone,
}: Props) {
  const [show, setShow] = useState(true);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (sound) playChime('reward');
    const t = setTimeout(() => setShow(false), 1700);
    return () => clearTimeout(t);
  }, [sound]);

  // 中心から放射する小さな光の粒
  const sparkles = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    const dist = 78;
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, delay: i * 0.018 };
  });

  return (
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 30,
            background:
              'radial-gradient(circle at center, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.12) 45%, transparent 75%)',
            backdropFilter: 'blur(1.5px)',
          }}
        >
          {/* 中心の光のオーブ */}
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            {!reduce &&
              sparkles.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                  animate={{ x: s.x, y: s.y, scale: [0, 1, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.95, delay: 0.12 + s.delay, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    top: 'calc(50% - 3px)',
                    left: 'calc(50% - 3px)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                  }}
                />
              ))}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduce
                  ? { duration: 0.2 }
                  : { type: 'spring', stiffness: 320, damping: 14, delay: 0.05 }
              }
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${accent} 0%, ${accent}88 55%, transparent 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 44,
                boxShadow: `0 0 38px ${accent}99`,
              }}
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={reduce ? { duration: 0.2 } : { delay: 0.22, type: 'spring', stiffness: 420, damping: 16 }}
                style={{ color: '#fff', fontWeight: 900 }}
              >
                ✓
              </motion.span>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.3 }}
            style={{
              marginTop: 20,
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#fff',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}
          >
            {label}
          </motion.p>
          {detail && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              style={{
                marginTop: 4,
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.82)',
                textShadow: '0 1px 8px rgba(0,0,0,0.6)',
              }}
            >
              {detail}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
