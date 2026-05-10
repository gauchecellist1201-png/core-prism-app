// ============================================================
// IncomingBriefBanner — AI コーチからの新着ブリーフ通知バナー
// ============================================================
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import type { CoachBrief } from '../lib/coachScheduler';
import { getSlotLabel } from '../lib/coachScheduler';

interface Props {
  brief: CoachBrief;
  persona: Persona;
  onRead: () => void;
  onDismiss: () => void;
  voiceEnabled?: boolean;
  onSpeak?: (text: string) => void;
}

export default function IncomingBriefBanner({
  brief,
  persona,
  onRead,
  onDismiss,
  voiceEnabled,
  onSpeak,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 8 秒で自動フェードアウト
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  const slotLabel = getSlotLabel(brief.slot);

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3 pt-2"
      initial={{ y: -88, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -88, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: `linear-gradient(135deg, ${persona.accentColor}20, ${persona.accentColor}0c)`,
          border: `1px solid ${persona.accentColor}55`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* アイコン */}
          <motion.div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: `${persona.accentColor}28`, color: persona.accentColor }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            🧠
          </motion.div>

          {/* テキスト */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-semibold tracking-widest uppercase leading-none mb-0.5"
              style={{ color: persona.accentColor }}
            >
              AI コーチ · {slotLabel}のブリーフができました
            </p>
            <p className="text-fg text-sm font-semibold leading-snug truncate">
              {brief.title}
            </p>
          </div>

          {/* ボタン群 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onRead}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all active:scale-95"
              style={{
                background: persona.accentColor,
                color: '#0a0a0f',
                boxShadow: `0 4px 12px ${persona.accentColor}44`,
              }}
            >
              読む
            </button>

            {voiceEnabled && onSpeak && (
              <button
                onClick={() => {
                  onSpeak(`${brief.title}。${brief.message}`);
                  onDismiss();
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-all active:scale-95"
                style={{
                  background: 'var(--surface-3)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                }}
              >
                🔊 聴く
              </button>
            )}

            <button
              onClick={onDismiss}
              className="text-xs w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-surface-3 active:scale-95"
              style={{ color: 'var(--fg-muted)' }}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
