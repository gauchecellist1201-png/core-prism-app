import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';

interface Props {
  persona: Persona;
  onClose: () => void;
}

const DURATIONS = [15, 30, 45, 60] as const;

export default function MeetingHub({ persona, onClose }: Props) {
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30);
  const [title, setTitle] = useState(`${persona.name}とのミーティング`);
  const [copied, setCopied] = useState(false);

  const meetingUrl = `https://core-os.app/meet/${persona.meetingSlug}/${duration}min`;

  const handleCopy = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoogleCalendar = () => {
    const text = encodeURIComponent(title);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${encodeURIComponent(`ミーティングリンク: ${meetingUrl}`)}&duration=${String(duration).padStart(2, '0')}00`;
    window.open(url, '_blank');
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md m-4 p-6 rounded-2xl"
        style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)' }}
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span style={{ color: persona.accentColor }}>{persona.icon}</span>
            <p className="text-fg text-sm font-light">ミーティングリンク</p>
          </div>
          <button onClick={onClose} className="text-neutral-600 hover:text-fg-subtle">×</button>
        </div>

        {/* タイトル */}
        <div className="mb-4">
          <p className="text-neutral-600 text-xs tracking-wider uppercase mb-2">ミーティング名</p>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-transparent text-fg text-sm font-light outline-none border-b py-2"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />
        </div>

        {/* 時間 */}
        <div className="mb-5">
          <p className="text-neutral-600 text-xs tracking-wider uppercase mb-2">時間</p>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className="flex-1 py-2 rounded-lg text-xs transition-all"
                style={{
                  background: duration === d ? persona.accentColorLight : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${duration === d ? persona.accentColor : 'rgba(255,255,255,0.06)'}`,
                  color: duration === d ? persona.accentColor : '#4a4a6a',
                }}
              >
                {d}分
              </button>
            ))}
          </div>
        </div>

        {/* URL */}
        <div
          className="flex items-center gap-2 p-3 rounded-xl mb-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="flex-1 text-xs font-mono text-fg-subtle truncate">{meetingUrl}</p>
          <motion.button
            onClick={handleCopy}
            className="text-xs px-3 py-1 rounded-lg flex-shrink-0 transition-all"
            style={{
              background: copied ? 'rgba(52,211,153,0.15)' : persona.accentColorLight,
              color: copied ? '#34d399' : persona.accentColor,
            }}
            whileTap={{ scale: 0.95 }}
          >
            {copied ? '✓ コピー済' : 'コピー'}
          </motion.button>
        </div>

        {/* アクション */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={handleGoogleCalendar}
            className="py-3 rounded-xl text-xs font-light flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'rgba(66,133,244,0.1)',
              border: '1px solid rgba(66,133,244,0.2)',
              color: '#4285F4',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>📅</span> Googleカレンダーへ
          </motion.button>
          <motion.button
            onClick={() => navigator.clipboard.writeText(
              `${title}\n時間: ${duration}分\nリンク: ${meetingUrl}`
            )}
            className="py-3 rounded-xl text-xs font-light flex items-center justify-center gap-2 transition-all"
            style={{
              background: persona.accentColorLight,
              border: `1px solid ${persona.accentColor}30`,
              color: persona.accentColor,
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>📤</span> テキストでシェア
          </motion.button>
        </div>

        {/* 説明 */}
        <div
          className="mt-4 p-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <p className="text-xs text-neutral-600 leading-relaxed">
            このリンクを共有すると、相手は{persona.name}としてのあなたの空き時間を確認してミーティングを予約できます。
            Googleカレンダーと連携することで自動的にスケジュールが管理されます。
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
