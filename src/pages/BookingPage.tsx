import { useMemo, useState } from 'react';
import type { BookingConfig } from '../types/scheduling';
import {
  groupSlotsByDay, formatSlot, bookingLocationLabel,
  buildGoogleCalendarUrl, buildIcs, type BookingDetails,
} from '../lib/scheduling';

/**
 * ゲストが予約リンク (?book=...) を開いたときに表示する受信ページ。
 * ホストの Google 認証なしで成立する正直な動線:
 *   枠を選ぶ → 名前/メール → ワンクリックで Google カレンダー登録 (ホストへ招待) + .ics フォールバック。
 */
export default function BookingPage({ cfg }: { cfg: BookingConfig }) {
  const accent = cfg.personaColor || '#6366f1';
  const days = useMemo(() => groupSlotsByDay(cfg.slots || []), [cfg.slots]);

  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const emailOk = /.+@.+\..+/.test(email.trim());
  const canBook = !!slot && name.trim().length > 0 && emailOk;

  const details: BookingDetails | null = slot
    ? { cfg, slotIso: slot, guestName: name.trim(), guestEmail: email.trim() }
    : null;

  function confirm() {
    if (!details) return;
    window.open(buildGoogleCalendarUrl(details), '_blank', 'noopener');
    setDone(true);
  }

  function downloadIcs() {
    if (!details) return;
    const blob = new Blob([buildIcs(details)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${cfg.meetingName || '予約'}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── 予約確定後 ──
  if (done && details) {
    const f = formatSlot(slot!);
    return (
      <Shell accent={accent} cfg={cfg}>
        <div className="text-center py-2">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
               style={{ background: `${accent}1a`, color: accent }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h2 className="text-fg text-lg font-bold mb-1">日程を確定しました</h2>
          <p className="text-fg-muted text-sm mb-5">
            {f.dateLabel}（{f.weekdayShort}）{f.timeLabel} 〜 ／ {bookingLocationLabel(cfg)}
          </p>
          <div className="rounded-2xl p-4 mb-4 text-left text-sm leading-relaxed"
               style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
            <p className="text-fg-muted">
              別タブで <b className="text-fg">Google カレンダー</b> が開きました。「保存」を押すと予定が登録され、
              <b className="text-fg">{cfg.host}</b> さんにも招待メールが届きます。
            </p>
          </div>
          <button onClick={downloadIcs}
            className="w-full min-h-[48px] rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface-3)', color: 'var(--fg)', border: '1px solid var(--border)' }}>
            別のカレンダーに追加（.ics をダウンロード）
          </button>
          {cfg.hostEmail && (
            <p className="text-fg-subtle text-xs mt-4">
              タブが開かなかった場合は <a href={`mailto:${cfg.hostEmail}?subject=${encodeURIComponent('予約: ' + cfg.meetingName)}`} className="underline" style={{ color: accent }}>{cfg.hostEmail}</a> へご連絡ください。
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ── 空き枠なし ──
  if (days.length === 0) {
    return (
      <Shell accent={accent} cfg={cfg}>
        <div className="text-center py-6">
          <p className="text-fg font-semibold mb-1">いま予約できる枠がありません</p>
          <p className="text-fg-muted text-sm mb-5">タイミングを変えて再度お試しいただくか、ホストへ直接ご連絡ください。</p>
          {cfg.hostEmail && (
            <a href={`mailto:${cfg.hostEmail}?subject=${encodeURIComponent('日程のご相談: ' + cfg.meetingName)}`}
              className="inline-flex items-center justify-center min-h-[48px] px-5 rounded-xl text-sm font-semibold text-white" style={{ background: accent }}>
              {cfg.host} さんにメールで相談する
            </a>
          )}
        </div>
      </Shell>
    );
  }

  // ── 枠選択 + フォーム ──
  return (
    <Shell accent={accent} cfg={cfg}>
      <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">空いている日時を選ぶ</p>
      <div className="space-y-4 mb-6">
        {days.map(day => (
          <div key={day.dayKey}>
            <p className="text-fg text-sm font-semibold mb-2">{day.dayLabel}（{day.weekday}）</p>
            <div className="grid grid-cols-3 gap-2">
              {day.iso.map(iso => {
                const sel = slot === iso;
                return (
                  <button key={iso} onClick={() => setSlot(iso)}
                    className="min-h-[44px] rounded-xl text-sm font-medium transition-colors"
                    style={{
                      background: sel ? accent : 'var(--surface-3)',
                      color: sel ? '#fff' : 'var(--fg)',
                      border: `1px solid ${sel ? accent : 'var(--border)'}`,
                    }}>
                    {formatSlot(iso).timeLabel}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="お名前"
          className="w-full min-h-[48px] px-4 rounded-xl text-[16px] outline-none"
          style={{ background: 'var(--surface-3)', color: 'var(--fg)', border: '1px solid var(--border)' }} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="メールアドレス" inputMode="email" autoComplete="email"
          className="w-full min-h-[48px] px-4 rounded-xl text-[16px] outline-none"
          style={{ background: 'var(--surface-3)', color: 'var(--fg)', border: `1px solid ${email && !emailOk ? '#ef4444' : 'var(--border)'}` }} />
        {email && !emailOk && <p className="text-xs" style={{ color: '#ef4444' }}>メールアドレスの形式をご確認ください</p>}

        <button onClick={confirm} disabled={!canBook}
          className="w-full min-h-[52px] rounded-xl text-base font-bold text-white transition-opacity"
          style={{ background: accent, opacity: canBook ? 1 : 0.45 }}>
          {slot ? `${formatSlot(slot).dateLabel} ${formatSlot(slot).timeLabel} で予約する` : '日時を選んでください'}
        </button>
        <p className="text-fg-subtle text-xs text-center leading-relaxed">
          「予約する」で Google カレンダーが開きます。保存すると {cfg.host} さんに招待が届きます。<br />費用はかかりません。
        </p>
      </div>
    </Shell>
  );
}

function Shell({ cfg, accent, children }: { cfg: BookingConfig; accent: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] w-full flex justify-center" style={{ background: 'var(--surface-1, #0b0b0f)' }}>
      <div className="w-full max-w-md px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* ヘッダー */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--surface-2, #14141b)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl font-bold"
                 style={{ background: `${accent}22`, color: accent }}>
              {cfg.personaIcon || (cfg.host || '·').slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="text-fg font-semibold leading-tight truncate">{cfg.host}</p>
              <p className="text-fg-muted text-xs truncate">との日程調整</p>
            </div>
          </div>
          <h1 className="text-fg text-lg font-bold leading-tight">{cfg.meetingName}</h1>
          {cfg.description && <p className="text-fg-muted text-sm mt-1 leading-relaxed">{cfg.description}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <Pill>{cfg.duration}分</Pill>
            <Pill>{bookingLocationLabel(cfg)}</Pill>
          </div>
        </div>
        {children}
        <p className="text-fg-subtle text-[11px] text-center mt-6">Powered by CORE Prism</p>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs"
      style={{ background: 'var(--surface-3)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
      {children}
    </span>
  );
}
