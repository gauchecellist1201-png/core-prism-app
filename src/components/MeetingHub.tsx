import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, CalendarPlus, Share2, Inbox, RefreshCw } from 'lucide-react';
import type { Persona } from '../types/identity';
import { copyText } from '../lib/clipboard';
import { StudioIntro } from './StudioIntro';
import PersonaGlyph from './PersonaGlyph';
import StudioBackButton from './StudioBackButton';
import MeetingScheduler from './MeetingScheduler';
import { formatSlot } from '../lib/scheduling';
import { onAccent } from '../lib/accentFace';
import {
  loadInbox, markInboxSeen, unreadCount,
  type InboxState, type InboxBooking,
} from '../lib/bookingInbox';

interface Props {
  persona: Persona;
  onClose: () => void;
}

const DURATIONS = [15, 30, 45, 60] as const;

export default function MeetingHub({ persona, onClose }: Props) {
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30);
  const [title, setTitle] = useState(`${persona.name}とのミーティング`);
  const [showScheduler, setShowScheduler] = useState(false);

  // 相手が予約を押したら、この画面に出す。以前は Google の招待メールしか手がかりが無かった。
  const [inbox, setInbox] = useState<InboxState | null>(null);
  const [reloading, setReloading] = useState(false);

  const refreshInbox = useCallback(async () => {
    setReloading(true);
    try {
      setInbox(await loadInbox());
    } finally {
      setReloading(false);
    }
  }, []);

  useEffect(() => { void refreshInbox(); }, [refreshInbox]);

  // 一覧を出せたら「見た」を記録（次からは新着だけが光る）
  useEffect(() => {
    if (inbox?.phase === 'ok' && inbox.bookings.length > 0) void markInboxSeen();
  }, [inbox]);

  const unread = inbox?.phase === 'ok' ? unreadCount(inbox.bookings, inbox.seenAt) : 0;

  // 2026-07-31: ここは長いあいだ `/meet/<slug>/30min` という**どこにも繋がっていない URL** を
  // コピーさせていた（この経路のページは存在しない）。相手に送っても予約できないので、
  // 実際に動く「予約リンク（?book=…）」を作る画面へつなぎ替えた。
  // 受信側は BookingPage が既に実装済み。作る側だけが画面から呼ばれていなかった。

  const handleGoogleCalendar = () => {
    const text = encodeURIComponent(title);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&duration=${String(duration).padStart(2, '0')}00`;
    window.open(url, '_blank');
  };

  if (showScheduler) {
    return <MeetingScheduler persona={persona} onClose={() => setShowScheduler(false)} />;
  }

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
        className="w-full max-w-md m-4 p-6 rounded-2xl overflow-y-auto"
        style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 'calc(100dvh - 2rem)' }}
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <StudioBackButton onClick={onClose} />
            <PersonaGlyph icon={persona.icon} color={persona.accentColor} size={18} />
            <p className="text-fg text-sm font-light">ミーティングリンク</p>
          </div>
          <button onClick={onClose} className="text-neutral-600 hover:text-fg-subtle text-xl flex items-center justify-center" style={{ minWidth: 44, minHeight: 44 }} aria-label="閉じる">✕</button>
        </div>

        <StudioIntro
          id="meetinghub"
          accent={persona.accentColor}
          iconKey="meeting"
          what="打ち合わせの日程を、相手に選んでもらうためのリンクを作る場所です。"
          tryThis="ミーティング名と時間を選んで「予約リンクを作る」を押すだけ。"
          example="「30 分の打ち合わせ」を作る → 空いている時間が並んだ 1 本の URL ができ、相手が押した時間で確定します。"
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
              <div style={{ opacity: 0.55, fontSize: 5.5, marginBottom: 5 }}>5/23 (金) 14:00〜14:30</div>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: `${persona.accentColor}14`,
                  border: `1px solid ${persona.accentColor}44`,
                  borderRadius: 5, padding: '4px 6px', marginBottom: 5,
                }}
              >
                <span style={{ fontSize: 6, opacity: 0.85, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  空き時間から選んで予約
                </span>
                <span style={{ fontSize: 5.5, fontWeight: 800, color: persona.accentColor }}>コピー</span>
              </div>
              <div style={{ fontSize: 5.5, opacity: 0.6 }}>相手に送るだけ。押された時間で確定します</div>
            </div>
          }
        />

        {/* 入った予約（相手が押した日時） */}
        <BookingInbox
          state={inbox}
          unread={unread}
          reloading={reloading}
          accent={persona.accentColor}
          onReload={() => void refreshInbox()}
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

        {/* 予約リンクを作る（本命の導線） */}
        <motion.button
          onClick={() => setShowScheduler(true)}
          className="w-full py-3 rounded-xl text-sm font-medium mb-2 flex items-center justify-center gap-2"
          style={{ ...onAccent(persona.accentColor) }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link2 size={16} strokeWidth={2} aria-hidden />
          空き時間つきの予約リンクを作る
        </motion.button>
        <p className="text-fg-muted text-[11px] leading-relaxed mb-4">
          Google カレンダーの空き時間を読んで、相手が押すだけで決まるリンクを作ります。
          （カレンダー未接続でも、曜日と時間帯だけで作れます）
        </p>

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
            <CalendarPlus size={14} strokeWidth={2} aria-hidden /> Googleカレンダーへ
          </motion.button>
          <motion.button
            onClick={() => copyText(
              `${title}\n時間: ${duration}分`,
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
            <Share2 size={14} strokeWidth={2} aria-hidden /> テキストでシェア
          </motion.button>
        </div>

        {/* 説明 */}
        <div
          className="mt-4 p-3 rounded-xl"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
        >
          <p className="text-fg-muted text-xs leading-relaxed">
            日時がもう決まっているなら <b className="text-fg">Googleカレンダーへ</b>。
            相手に選んでもらうなら <b className="text-fg">予約リンク</b>。どちらも相手のアプリだけで完了します。
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── 入った予約（受信箱） ─────────────────────────────
// 読めなかったときに欄ごと消すと「1件も来ていない」と誤解する。
// 必ず理由ともう一度読み込むボタンを出す。
function BookingInbox({
  state, unread, reloading, accent, onReload,
}: {
  state: InboxState | null;
  unread: number;
  reloading: boolean;
  accent: string;
  onReload: () => void;
}) {
  // まだリンクを1本も作っていない人には、空の受信箱を見せない
  if (state?.phase === 'off') return null;

  const count = state?.phase === 'ok' ? state.bookings.length : 0;

  return (
    <div
      className="mb-5 rounded-xl overflow-hidden"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Inbox size={15} strokeWidth={2} style={{ color: accent }} aria-hidden />
        <p className="text-fg text-xs font-medium flex-1">入った予約</p>
        {unread > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ ...onAccent(accent) }}
          >
            新着 {unread}
          </span>
        )}
        <button
          onClick={onReload}
          disabled={reloading}
          className="flex items-center justify-center rounded-lg"
          style={{ minWidth: 32, minHeight: 32, color: 'var(--fg-muted)', opacity: reloading ? 0.5 : 1 }}
          aria-label="予約を読み込み直す"
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="px-3 py-3">
        {state === null && <p className="text-fg-muted text-xs">読み込んでいます…</p>}

        {state?.phase === 'error' && (
          <div>
            <p className="text-fg text-xs mb-1">予約を読み込めませんでした。</p>
            <p className="text-fg-muted text-[11px] leading-relaxed mb-2">
              {state.message}届いている予約が消えたわけではありません。
            </p>
            <button
              onClick={onReload}
              className="text-[11px] font-medium px-3 rounded-lg"
              style={{ minHeight: 36, background: `${accent}1f`, color: accent, border: `1px solid ${accent}44` }}
            >
              もう一度読み込む
            </button>
          </div>
        )}

        {state?.phase === 'unconfigured' && (
          <p className="text-fg-muted text-[11px] leading-relaxed">
            いまは予約の保管場所が未設定のため、この画面では受け取れません。
            リンク自体は使えて、相手が保存すれば <b className="text-fg">招待メール</b> は届きます。
          </p>
        )}

        {state?.phase === 'ok' && count === 0 && (
          <p className="text-fg-muted text-[11px] leading-relaxed">
            まだ予約は入っていません。相手がリンクの時間を押すと、ここに出ます。
          </p>
        )}

        {state?.phase === 'ok' && count > 0 && (
          <>
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 220 }}>
              {state.bookings.map(b => (
                <BookingRow key={b.id} b={b} accent={accent} />
              ))}
            </div>
            <p className="text-fg-subtle text-[10px] leading-relaxed mt-2.5">
              相手が予約ボタンを押した記録です。相手が Google カレンダーで保存し切ったかまでは分かりません。
              招待メールが届いていれば確定です。
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function BookingRow({ b, accent }: { b: InboxBooking; accent: string }) {
  const f = formatSlot(b.slotIso);
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline gap-2">
        <p className="text-fg text-xs font-semibold" style={{ color: accent }}>
          {f.dateLabel}（{f.weekdayShort}）{f.timeLabel}
        </p>
        <p className="text-fg-subtle text-[10px]">{b.durationMin}分</p>
      </div>
      <p className="text-fg text-xs mt-0.5 truncate">
        {b.guestName || 'お名前なし'}
        {b.guestEmail && <span className="text-fg-muted"> ・ {b.guestEmail}</span>}
      </p>
      <p className="text-fg-subtle text-[10px] mt-0.5 truncate">
        {b.meetingName}{b.location ? ` ・ ${b.location}` : ''}
      </p>
    </div>
  );
}
