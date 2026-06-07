// ============================================================
// AiThrottleToast — AI が混雑して bypass 中であることを伝える小さな帯
//
// オーナー指示 (2026-06-04 第 18 波 PPP):
//   /api/ai が 429/503/timeout した時に「混雑中、N 秒待機」を UI に。
//   aiBackoff.ts が dispatch する `core:ai-throttle` イベントを購読。
// ============================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

export default function AiThrottleToast() {
  const [waitSec, setWaitSec] = useState<number>(0);
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    const onEv = (e: Event) => {
      const d = (e as CustomEvent<{ waitSec: number; reason: string }>).detail;
      if (!d) return;
      setWaitSec(d.waitSec);
      setReason(d.reason);
    };
    window.addEventListener('core:ai-throttle', onEv as EventListener);
    return () => window.removeEventListener('core:ai-throttle', onEv as EventListener);
  }, []);

  // カウントダウン
  useEffect(() => {
    if (waitSec <= 0) return;
    const id = window.setInterval(() => {
      setWaitSec(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [waitSec]);

  const visible = waitSec > 0;
  const label = reason === '429'
    ? `混雑中。AI 自動再試行まで`
    : reason === '503'
      ? `AI サーバ調整中`
      : reason === 'network'
        ? `通信不安定`
        : `AI 待機中`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -10, x: '-50%' }}
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            left: '50%',
            zIndex: 90,
            background: 'rgba(15,14,27,0.92)',
            border: '1px solid rgba(251,191,36,0.5)',
            borderRadius: 999,
            padding: '6px 14px',
            color: '#fde68a',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 8px 18px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <Clock size={12} /> {label} {waitSec} 秒
        </motion.div>
      )}
    </AnimatePresence>
  );
}
