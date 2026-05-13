// ============================================================
// CORE Iris ▸ ウェルカム体験
// 開いた瞬間 2.5s のシネマティック スプラッシュ → AI 先回りヒーロー
// 「Iris は寝ている間に動いてくれていた」感を演出
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Flame, Clapperboard, Mail, CalendarClock, ChevronRight } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

const SESSION_KEY = 'iris_welcome_seen_v2';

interface SplashProps {
  bg: IrisBackgroundDef;
  handle?: string;
}

export function IrisSplash({ bg, handle }: SplashProps) {
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
    hour < 5  ? 'まだ起きてたんですね、整理しときました' :
    hour < 10 ? '朝の Iris、起動済みです' :
    hour < 14 ? '今日もきれいに、伸ばしていきましょう' :
    hour < 18 ? '夕方の追い込み、整えました' :
    hour < 22 ? '夜の創造の時間です' :
                '今夜のメモ、明日のあなたへ';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="iris-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => { try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {/* */} setShow(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: `radial-gradient(ellipse at center, ${bg.accent}28 0%, rgba(15, 12, 30, 0.92) 50%, rgba(10, 8, 20, 0.98) 100%)`,
            backdropFilter: 'blur(28px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {/* 背景: 多層オーブ */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: 600, height: 600, borderRadius: '50%',
              background: `radial-gradient(circle, ${bg.accent}66 0%, transparent 70%)`,
              filter: 'blur(60px)',
              pointerEvents: 'none',
            }}
          />
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: 0 }}
            animate={{ scale: 1, opacity: 0.55, rotate: 180 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: 800, height: 800, borderRadius: '50%',
              background: `conic-gradient(from 0deg, ${bg.accent}55, transparent, ${bg.accent}88, transparent, ${bg.accent}55)`,
              filter: 'blur(80px)',
              pointerEvents: 'none',
            }}
          />

          {/* 中央オーブ */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.15, 1], opacity: [0, 1, 1] }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            style={{
              width: 120, height: 120, borderRadius: '50%',
              background: `linear-gradient(135deg, ${bg.accent}, #F472B6, #FBBF24)`,
              boxShadow: `0 0 80px ${bg.accent}aa, 0 0 200px ${bg.accent}55, inset 0 -16px 30px rgba(0,0,0,0.25), inset 0 16px 30px rgba(255,255,255,0.4)`,
              marginBottom: '2rem',
              animation: 'iris-orb-pulse 2.5s ease-in-out infinite',
            }}
          />

          {/* IRIS ワードマーク */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            style={{
              fontFamily: 'Cinzel, "Noto Serif JP", serif',
              fontSize: 'clamp(2.4rem, 7vw, 4rem)',
              letterSpacing: '0.4em',
              fontWeight: 500,
              background: `linear-gradient(135deg, #fff, ${bg.accent}cc)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.4rem',
            }}>
            IRIS
          </motion.div>

          {/* @handle */}
          {handle && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              style={{
                fontSize: '0.78rem', letterSpacing: '0.18em',
                color: '#fff', marginBottom: '1.5rem',
                fontFamily: IRIS_FONTS.body,
              }}>
              {handle}
            </motion.div>
          )}

          {/* 一言 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.9, y: 0 }}
            transition={{ delay: 1.3, duration: 0.7 }}
            style={{
              fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
              fontSize: 'clamp(0.95rem, 2.4vw, 1.2rem)',
              color: '#fff', textAlign: 'center',
              maxWidth: '80%', lineHeight: 1.6,
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
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
              fontFamily: IRIS_FONTS.body,
            }}>
            タップしてスキップ
          </motion.div>

          <style>{`
            @keyframes iris-orb-pulse {
              0%, 100% { transform: scale(1); filter: brightness(1); }
              50% { transform: scale(1.08); filter: brightness(1.15); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// AI 先回りヒーロー (Home 上部に常設)
// ============================================================

interface HeroProps {
  bg: IrisBackgroundDef;
  handle?: string;
  preparedReel?: { name: string; reason: string };
  readyPostCount?: number;
  pendingReplies?: number;
  onJump?: (tab: string) => void;
}

export function IrisHeroGreeting({ bg, handle, preparedReel, readyPostCount = 0, pendingReplies = 0, onJump }: HeroProps) {
  const hour = new Date().getHours();
  const greeting = useMemo(() => {
    if (hour < 5)  return { line1: 'おやすみ前に',  line2: 'Iris は明日に備えています' };
    if (hour < 10) return { line1: 'おはようございます', line2: '朝の Iris、起動済み' };
    if (hour < 14) return { line1: 'こんにちは',    line2: '昼の伸びる時間です' };
    if (hour < 18) return { line1: 'おかえりなさい', line2: '夕方を整えていきましょう' };
    if (hour < 22) return { line1: '今夜の Iris',   line2: '創造の時間です' };
    return { line1: 'おつかれさま',   line2: '夜のメモを残しましょう' };
  }, [hour]);

  // AI が「先回りで用意したもの」
  const preparedItems = useMemo(() => {
    const items: { icon: any; label: string; sub: string; tab: string }[] = [];
    if (preparedReel) {
      items.push({
        icon: Clapperboard,
        label: `今日のリール「${preparedReel.name}」`,
        sub: preparedReel.reason,
        tab: 'reel',
      });
    }
    if (readyPostCount > 0) {
      items.push({
        icon: CalendarClock,
        label: `予約投稿 ${readyPostCount} 件、出番待ち`,
        sub: 'Instagram で 1 タップ投稿の準備済み',
        tab: 'schedule',
      });
    }
    if (pendingReplies > 0) {
      items.push({
        icon: Mail,
        label: `案件 ${pendingReplies} 件、一次対応必要`,
        sub: 'AI 下書きをすぐ生成できます',
        tab: 'deals',
      });
    }
    // 何も無ければ「キレイな空 」を演出
    if (items.length === 0) {
      items.push({
        icon: Sparkles,
        label: '今日は静かな朝',
        sub: '新しい一本、はじめましょう',
        tab: 'reel',
      });
    }
    return items;
  }, [preparedReel, readyPostCount, pendingReplies]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      style={{
        position: 'relative',
        padding: '1.5rem 1.3rem 1.2rem',
        background: `linear-gradient(135deg, ${bg.accent}1F 0%, ${bg.accent}08 40%, transparent 100%)`,
        border: `1px solid ${bg.accent}40`,
        borderRadius: 22,
        overflow: 'hidden',
      }}>
      {/* 装飾オーブ */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${bg.accent}55 0%, transparent 70%)`,
        filter: 'blur(36px)',
        pointerEvents: 'none',
      }} />

      {/* 挨拶 */}
      <div style={{ marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <Flame size={11} color={bg.accent} />
          <span style={{ fontSize: '0.62rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 800 }}>
            {handle ? handle.toUpperCase() : '@YOU'} · IRIS が動いていました
          </span>
        </div>
        <h2 style={{
          margin: 0,
          fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
          fontSize: 'clamp(1.6rem, 5vw, 2.4rem)',
          color: bg.ink, fontWeight: 500, lineHeight: 1.1,
          letterSpacing: '-0.01em',
        }}>
          {greeting.line1}。
        </h2>
        <p style={{
          margin: '0.4rem 0 0',
          fontSize: '0.92rem', color: bg.inkSoft,
          fontFamily: IRIS_FONTS.body, lineHeight: 1.6,
        }}>
          {greeting.line2}。
        </p>
      </div>

      {/* AI が用意した 1-3 件 (staggered) */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
        }}
        style={{ display: 'grid', gap: 8, position: 'relative', zIndex: 1 }}
      >
        {preparedItems.map((it, idx) => (
          <motion.button
            key={idx}
            onClick={() => onJump?.(it.tab)}
            variants={{
              hidden: { opacity: 0, x: -8 },
              visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: 'easeOut' } },
            }}
            whileHover={{ scale: 1.015, x: 2 }}
            whileTap={{ scale: 0.99 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr auto',
              alignItems: 'center', gap: 12,
              padding: '0.7rem 0.85rem',
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.8)',
              borderRadius: 12,
              cursor: 'pointer', textAlign: 'left',
              color: bg.ink,
              fontFamily: IRIS_FONTS.body,
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <it.icon size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 2 }}>
                {it.label}
              </div>
              <div style={{ fontSize: '0.74rem', color: bg.inkSoft, lineHeight: 1.4 }}>
                {it.sub}
              </div>
            </div>
            <ChevronRight size={16} style={{ opacity: 0.5 }} />
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
