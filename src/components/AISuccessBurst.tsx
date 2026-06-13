// ============================================================
// AISuccessBurst — AI の処理が「完成した一瞬」に小さなごほうび演出を出す共通 UI
//
// なぜ作るか:
//  待ち時間 (AILoadingState) は磨いたが、「終わった瞬間」が無音だった。
//  議事録・営業文・画像などが出来上がった刹那に、
//   - ブランド色の光がふわっと広がる
//   - チェックマークがコンッと決まる
//   - 火花 (スパーク) が数粒だけ弾ける
//  を 1.7 秒だけ見せると、「やった、できた」という達成感が残り、また使いたくなる。
//  Granola / Linear の "完了トースト" と同じ発想を 1 つに集約して全 Studio に展開する。
//
// 使い方 (trigger が変わるたびに 1 回だけ発火):
//   const [doneKey, setDoneKey] = useState(0);
//   // 完成したら: setDoneKey(k => k + 1);
//   <AISuccessBurst trigger={doneKey} brand="prism" label="議事録が完成しました" />
//
// 「動きを減らす」設定の人には、火花なしの静かなフェードに自動で切替 (目にやさしい)。
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Props {
  /** この数値が変わるたびに 1 回だけ演出を出す (0 や初期値では出さない) */
  trigger: number;
  /** ブランドカラー (prism=紫, iris=ピンク) */
  brand?: 'prism' | 'iris';
  /** 中央に出すラベル — 「議事録が完成しました」「下書きができました」など */
  label?: string;
  /** 表示時間 (ms)。default 1700 */
  durationMs?: number;
}

const SPARKS = 8;

export default function AISuccessBurst({
  trigger,
  brand = 'prism',
  label = '完成しました',
  durationMs = 1700,
}: Props) {
  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const prevTrigger = useRef(trigger);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    // 初回マウントや trigger=0 では発火しない。値が「増えた」ときだけ祝う。
    if (trigger !== prevTrigger.current && trigger > 0) {
      prevTrigger.current = trigger;
      setVisible(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setVisible(false), durationMs);
    } else {
      prevTrigger.current = trigger;
    }
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [trigger, durationMs]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="success-burst"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '20px 16px',
            marginTop: 8,
            position: 'relative',
            pointerEvents: 'none',
          }}
        >
          {/* 広がる光の輪 — 達成の "波" */}
          {!reduce && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0.55 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                top: 18,
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${accent}55 0%, ${accent}00 70%)`,
              }}
            />
          )}

          {/* チェックマークのバッジ — コンッと決まる */}
          <motion.div
            initial={reduce ? { scale: 1 } : { scale: 0.2, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 520, damping: 18 }}
            style={{
              position: 'relative',
              width: 52,
              height: 52,
              borderRadius: 16,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 22px ${accent}66, 0 6px 18px ${accent}33`,
            }}
          >
            <Check size={28} color="#fff" strokeWidth={3} />

            {/* 火花 — 数粒だけ放射状に弾ける */}
            {!reduce &&
              Array.from({ length: SPARKS }).map((_, i) => {
                const angle = (i / SPARKS) * Math.PI * 2;
                const dist = 34;
                return (
                  <motion.span
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: Math.sin(angle) * dist,
                      opacity: 0,
                      scale: 0.3,
                    }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
                    style={{
                      position: 'absolute',
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: accent,
                      boxShadow: `0 0 6px ${accent}`,
                    }}
                  />
                );
              })}
          </motion.div>

          {/* ラベル */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.12, duration: 0.25 }}
            style={{
              fontSize: 13.5,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '0.01em',
              textAlign: 'center',
            }}
          >
            {label}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
