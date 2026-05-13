// ============================================================
// CORE Iris ▸ Bond Level Up
// 親密度レベルが上がった瞬間に小さな祝福アニメーションを表示
// ============================================================
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles } from 'lucide-react';
import { useIrisBond, LEVEL_VIBE } from './useIrisBond';
import { IRIS_FONTS, type IrisBackgroundDef } from './irisStyle';

interface Props {
  bg: IrisBackgroundDef;
}

const PARTICLES = 12;

export default function IrisBondLevelUp({ bg }: Props) {
  const bond = useIrisBond();
  const level = bond.levelUpTo;

  // 自動で 3.5 秒後に閉じる
  useEffect(() => {
    if (level !== null) {
      const t = setTimeout(() => bond.clearLevelUp(), 3500);
      return () => clearTimeout(t);
    }
  }, [level, bond]);

  return (
    <AnimatePresence>
      {level !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 2000,
          }}>
          {/* 背景フラッシュ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at center, ${bg.accent}28 0%, transparent 60%)`,
            }}
          />
          {/* パーティクル */}
          {Array.from({ length: PARTICLES }).map((_, i) => {
            const angle = (i / PARTICLES) * Math.PI * 2;
            const dist = 140 + Math.random() * 80;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0.4],
                }}
                transition={{ duration: 1.4, delay: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  width: 10, height: 10, borderRadius: '50%',
                  background: i % 2 === 0 ? bg.accent : '#F472B6',
                  boxShadow: `0 0 12px ${bg.accent}`,
                }}
              />
            );
          })}
          {/* メインカード */}
          <motion.div
            initial={{ y: 20, scale: 0.85, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            style={{
              position: 'relative',
              padding: '1.6rem 2rem',
              background: '#fff',
              borderRadius: 22,
              boxShadow: `0 24px 60px ${bg.accent}55`,
              textAlign: 'center',
              fontFamily: IRIS_FONTS.body,
              color: bg.ink,
              minWidth: 280,
            }}>
            <motion.div
              animate={{ rotate: [0, -8, 8, -4, 0] }}
              transition={{ duration: 0.8, delay: 0.15 }}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: `linear-gradient(135deg, ${bg.accent}, #F472B6)`,
                margin: '0 auto 0.7rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 10px 26px ${bg.accent}66`,
              }}>
              <Heart size={34} fill="#fff" color="#fff" />
            </motion.div>
            <div style={{
              fontSize: '0.62rem', letterSpacing: '0.28em',
              color: bg.accent, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginBottom: 6,
            }}>
              <Sparkles size={11} />
              BOND LEVEL UP
              <Sparkles size={11} />
            </div>
            <div style={{
              fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
              fontSize: '1.6rem', fontWeight: 500,
              letterSpacing: '-0.01em', lineHeight: 1.2,
            }}>
              Lv.{level} — {LEVEL_VIBE[level].title}
            </div>
            <div style={{ marginTop: 6, fontSize: '0.82rem', color: bg.inkSoft }}>
              {LEVEL_VIBE[level].tone}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
