// ============================================================
// CORE Prism ▸ ウェルカム体験
// 開いた瞬間 2.5s のシネマティック スプラッシュ
// 5 波長 (logic/empathy/creative/action/ethics) が脈動する球体
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SESSION_KEY = 'prism_welcome_seen_v2';

const PRISM_COLORS = {
  logic:    '#2E6FFF',
  empathy:  '#E84B97',
  creative: '#8E5CFF',
  action:   '#FF7A1A',
  ethics:   '#D9A41A',
};

interface SplashProps {
  /** ペルソナ名 / Anti / 任意 */
  personaName?: string;
}

export default function PrismSplash({ personaName }: SplashProps) {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return !sessionStorage.getItem(SESSION_KEY); } catch { return false; }
  });

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {/* */}
      setShow(false);
    }, 2800);
    return () => clearTimeout(t);
  }, [show]);

  const hour = new Date().getHours();
  const oneLiner =
    hour < 5  ? '深夜の思考に光を' :
    hour < 10 ? '朝、5つの自分が起き上がる' :
    hour < 14 ? '昼の決断を、磨いていきましょう' :
    hour < 18 ? '夕方の俯瞰、ここで' :
    hour < 22 ? '夜の戦略、組み立てていきましょう' :
                '明日の自分を、今ここで設計' ;

  const dismiss = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {/* */}
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="prism-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={dismiss}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'radial-gradient(ellipse at center, rgba(46,111,255,0.25) 0%, rgba(15,12,30,0.94) 50%, rgba(8,6,16,0.99) 100%)',
            backdropFilter: 'blur(28px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {/* 背景: 5 波長の球が同時に立ち上がる */}
          {Object.entries(PRISM_COLORS).map(([k, color], i) => (
            <motion.div
              key={k}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 0.4,
                x: Math.cos((i / 5) * Math.PI * 2) * 180,
                y: Math.sin((i / 5) * Math.PI * 2) * 180,
              }}
              transition={{ duration: 1.6, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: 280, height: 280, borderRadius: '50%',
                background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
                filter: 'blur(50px)',
                pointerEvents: 'none',
              }}
            />
          ))}

          {/* 中央プリズム球 (5色グラデで虹色のオーブ) */}
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: 0 }}
            animate={{ scale: [0, 1.15, 1], opacity: [0, 1, 1], rotate: 360 }}
            transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
            style={{
              width: 140, height: 140, borderRadius: '50%',
              background: `conic-gradient(from 0deg, ${PRISM_COLORS.logic}, ${PRISM_COLORS.empathy}, ${PRISM_COLORS.creative}, ${PRISM_COLORS.action}, ${PRISM_COLORS.ethics}, ${PRISM_COLORS.logic})`,
              boxShadow: '0 0 80px rgba(255,255,255,0.4), 0 0 200px rgba(46,111,255,0.4), inset 0 -16px 30px rgba(0,0,0,0.25), inset 0 16px 30px rgba(255,255,255,0.5)',
              marginBottom: '2rem',
              animation: 'prism-orb-rotate 8s linear infinite, prism-orb-pulse 2.5s ease-in-out infinite',
              position: 'relative',
              zIndex: 2,
            }}>
            {/* 内側のハイライト */}
            <div style={{
              position: 'absolute', inset: '12%', borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.85), transparent 50%)',
              pointerEvents: 'none',
            }} />
          </motion.div>

          {/* CORE PRISM ワードマーク */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.7 }}
            style={{
              fontFamily: 'Cinzel, "Noto Serif JP", serif',
              fontSize: 'clamp(2rem, 6vw, 3.4rem)',
              letterSpacing: '0.3em',
              fontWeight: 500,
              background: `linear-gradient(135deg, #fff, ${PRISM_COLORS.logic}cc)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.3rem',
              position: 'relative', zIndex: 2,
            }}>
            CORE PRISM
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 1.05, duration: 0.6 }}
            style={{
              fontSize: '0.7rem', letterSpacing: '0.4em',
              color: '#fff', marginBottom: '1.4rem',
              fontFamily: '"Noto Sans JP", system-ui, sans-serif',
              position: 'relative', zIndex: 2,
            }}>
            7 PERSONAS ・ 1 IDENTITY
          </motion.div>

          {/* persona name (if any) */}
          {personaName && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              style={{
                fontFamily: '"Noto Serif JP", serif', fontStyle: 'italic',
                fontSize: '1.05rem', color: '#fff',
                marginBottom: '1rem',
                position: 'relative', zIndex: 2,
              }}>
              {personaName} として、今日も。
            </motion.div>
          )}

          {/* 一言 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.92, y: 0 }}
            transition={{ delay: 1.4, duration: 0.7 }}
            style={{
              fontFamily: '"Noto Serif JP", serif', fontStyle: 'italic',
              fontSize: 'clamp(0.92rem, 2.2vw, 1.15rem)',
              color: '#fff', textAlign: 'center',
              maxWidth: '80%', lineHeight: 1.65,
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
              position: 'relative', zIndex: 2,
            }}>
            {oneLiner}
          </motion.div>

          {/* スキップヒント */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 2.0, duration: 0.5 }}
            style={{
              position: 'absolute', bottom: '8%',
              fontSize: '0.72rem', color: '#fff',
              letterSpacing: '0.15em',
              fontFamily: '"Noto Sans JP", system-ui',
            }}>
            タップしてスキップ
          </motion.div>

          <style>{`
            @keyframes prism-orb-rotate {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            @keyframes prism-orb-pulse {
              0%, 100% { filter: brightness(1); }
              50%      { filter: brightness(1.15); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
