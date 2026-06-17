import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '../types/identity';
import { copyText } from '../lib/clipboard';
import { StudioIntro } from './StudioIntro';

interface Props {
  persona: Persona;
  onClose: () => void;
}

const DURATIONS = [15, 30, 45, 60] as const;

export default function MeetingHub({ persona, onClose }: Props) {
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30);
  const [title, setTitle] = useState(`${persona.name}とのミーティング`);
  const [copied, setCopied] = useState(false);

  // ミーティングリンクは現状デモ用 (受信側の予約ページは未実装)
  // 実装まではユーザーに「準備中」と明示し、Google カレンダー連携で実用は満たす
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://core-prism-app.vercel.app';
  const meetingUrl = `${origin}/meet/${persona.meetingSlug || persona.id}/${duration}min`;

  const handleCopy = async () => {
    const ok = await copyText(meetingUrl, 'リンク', { silentSuccess: true });
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          <button onClick={onClose} className="text-neutral-600 hover:text-fg-subtle text-xl flex items-center justify-center" style={{ minWidth: 44, minHeight: 44 }} aria-label="閉じる">✕</button>
        </div>

        <StudioIntro
          id="meetinghub"
          accent={persona.accentColor}
          iconKey="meeting"
          what="オンライン会議の入室リンクを作って、相手にコピペで送れる場所です。"
          tryThis="ミーティング名と時間を選んで、出てきたリンクをコピーするだけ。"
          example="「30 分の打ち合わせ」を作る → 1 本の URL ができ、相手に貼って送れます。"
          sampleLabel="こんなリンクが出ます"
          samplePreview={
            <div
              style={{
                width: 150,
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: 6,
                padding: '9px 10px',
                fontSize: 7,
                lineHeight: 1.4,
                boxShadow: 'var(--cp-elev-3)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                borderTop: `3px solid ${persona.accentColor}`,
              }}
              aria-label="ミーティングリンクのサンプル"
            >
              <div style={{ fontWeight: 800, fontSize: 8.5, marginBottom: 1 }}>30 分の打ち合わせ</div>
              <div style={{ opacity: 0.55, fontSize: 5.5, marginBottom: 5 }}>📅 5/23 (金) 14:00〜14:30</div>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: `${persona.accentColor}14`,
                  border: `1px solid ${persona.accentColor}44`,
                  borderRadius: 5, padding: '4px 6px', marginBottom: 5,
                }}
              >
                <span style={{ fontSize: 6, opacity: 0.85, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  meet.core/abc-1234
                </span>
                <span style={{ fontSize: 5.5, fontWeight: 800, color: persona.accentColor }}>コピー</span>
              </div>
              <div style={{ fontSize: 5.5, opacity: 0.6 }}>相手に貼って送るだけで入室できます</div>
            </div>
          }
        />

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
            onClick={() => copyText(
              `${title}\n時間: ${duration}分\nリンク: ${meetingUrl}`,
              'ミーティング情報',
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
          style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}
        >
          <p className="text-xs text-amber-300 leading-relaxed">
            ⚠️ 予約ページは現在準備中です。確実にミーティングを設定するには <b>Googleカレンダーへ</b> を押してください。
            URL のコピー / シェアは予約ページ完成までは案内目的でお使いください。
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
