// ============================================================
// 空き時間計算 + Booking URL エンコード/デコード
// ============================================================
import type { AvailabilityRules, BookingConfig, LocationKind } from '../types/scheduling';
import type { BusyInterval } from './googleCalendar';

/**
 * ルールに基づき、busy 配列を引いた空き時間スロットを生成する。
 * 出力は ISO 文字列の開始時刻リスト (各スロットは duration 分)。
 */
export function computeFreeSlots(opts: {
  rules: AvailabilityRules;
  durationMin: number;
  busy: BusyInterval[];
  now?: Date;
}): string[] {
  const { rules, durationMin, busy } = opts;
  const now = opts.now ?? new Date();
  const earliest = new Date(now.getTime() + rules.advanceMinHours * 3600_000);
  const latest = new Date(now); latest.setDate(latest.getDate() + rules.advanceMaxDays);

  const busyRanges = busy.map(b => ({ s: new Date(b.start).getTime(), e: new Date(b.end).getTime() }));
  const bufferMs = rules.bufferMin * 60_000;
  const stepMs = 15 * 60_000; // 15分刻みで枠を提示
  const durMs = durationMin * 60_000;

  const slots: string[] = [];
  // 曜日ごとに windows を走査
  for (let day = new Date(earliest); day <= latest; day = new Date(day.getTime() + 24 * 3600_000)) {
    if (!rules.weekdays.includes(day.getDay())) continue;
    for (const win of rules.windows) {
      const winStart = new Date(day); winStart.setHours(win.startHour, 0, 0, 0);
      const winEnd = new Date(day); winEnd.setHours(win.endHour, 0, 0, 0);
      for (let t = winStart.getTime(); t + durMs <= winEnd.getTime(); t += stepMs) {
        if (t < earliest.getTime()) continue;
        const slotStart = t - bufferMs;
        const slotEnd = t + durMs + bufferMs;
        const collides = busyRanges.some(b => !(slotEnd <= b.s || slotStart >= b.e));
        if (collides) continue;
        slots.push(new Date(t).toISOString());
      }
    }
  }
  return slots;
}

// ─── Booking URL エンコード / デコード ────────────────
const URL_PREFIX = '?book=';

/** UTF-8 セーフ Base64URL */
function b64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64UrlDecode(s: string): string {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function encodeBookingConfig(cfg: BookingConfig): string {
  return b64UrlEncode(JSON.stringify(cfg));
}
export function decodeBookingConfig(token: string): BookingConfig | null {
  try {
    const obj = JSON.parse(b64UrlDecode(token));
    if (obj && obj.v === 1 && Array.isArray(obj.slots)) return obj as BookingConfig;
    return null;
  } catch {
    return null;
  }
}

export function buildBookingUrl(cfg: BookingConfig, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
  return `${base}${URL_PREFIX}${encodeBookingConfig(cfg)}`;
}

export function parseBookingFromUrl(url?: string): BookingConfig | null {
  const target = url || (typeof window !== 'undefined' ? window.location.href : '');
  const m = target.match(/[?&]book=([^&#]+)/);
  if (!m) return null;
  return decodeBookingConfig(decodeURIComponent(m[1]));
}

// ─── デフォルトルール ────────────────────────────
export function defaultRules(): AvailabilityRules {
  return {
    weekdays: [1, 2, 3, 4, 5],   // 月〜金
    windows: [{ startHour: 10, endHour: 18 }],
    advanceMinHours: 4,
    advanceMaxDays: 14,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    bufferMin: 10,
  };
}

// ─── スロット表示用フォーマット ──────────────────
export function formatSlot(iso: string, locale = 'ja-JP'): { dateLabel: string; timeLabel: string; weekdayShort: string } {
  const d = new Date(iso);
  const dateLabel = d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const timeLabel = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const weekdayShort = d.toLocaleDateString(locale, { weekday: 'short' });
  return { dateLabel, timeLabel, weekdayShort };
}

export function groupSlotsByDay(slots: string[], locale = 'ja-JP'): { dayKey: string; dayLabel: string; weekday: string; iso: string[] }[] {
  const map = new Map<string, string[]>();
  for (const s of slots) {
    const key = s.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dayKey, list]) => {
    const d = new Date(dayKey + 'T00:00:00');
    return {
      dayKey,
      dayLabel: d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      weekday: d.toLocaleDateString(locale, { weekday: 'short' }),
      iso: list,
    };
  });
}

// ─── 予約確定 → カレンダー登録 (ゲスト側・OAuth 不要) ──────────────
const LOCATION_LABELS_JA: Record<LocationKind, string> = {
  'google-meet': 'Google Meet', 'zoom': 'Zoom', 'phone': '電話', 'in-person': '対面', 'custom': 'オンライン',
};

export function bookingLocationLabel(cfg: BookingConfig): string {
  if ((cfg.location === 'custom' || cfg.location === 'in-person') && cfg.customLocation) return cfg.customLocation;
  return LOCATION_LABELS_JA[cfg.location] || 'オンライン';
}

/** ISO 文字列 → Google Calendar / ICS 用 UTC 形式 (YYYYMMDDTHHMMSSZ) */
function toCalStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export interface BookingDetails {
  cfg: BookingConfig;
  slotIso: string;
  guestName: string;
  guestEmail: string;
}

function eventEndIso(slotIso: string, durationMin: number): string {
  return new Date(new Date(slotIso).getTime() + durationMin * 60_000).toISOString();
}

function eventTitle(d: BookingDetails): string {
  return `${d.cfg.meetingName} — ${d.cfg.host} × ${d.guestName || 'ゲスト'}`;
}

function eventDescription(d: BookingDetails): string {
  const lines = [
    d.cfg.description || '',
    `ホスト: ${d.cfg.host}${d.cfg.hostEmail ? ` (${d.cfg.hostEmail})` : ''}`,
    `ゲスト: ${d.guestName}${d.guestEmail ? ` (${d.guestEmail})` : ''}`,
    `場所: ${bookingLocationLabel(d.cfg)}`,
    'CORE Prism の日程調整で予約しました。',
  ];
  return lines.filter(Boolean).join('\n');
}

/** ワンクリックで Google カレンダーに予定を追加 (add= でホストを招待)。OAuth 不要。 */
export function buildGoogleCalendarUrl(d: BookingDetails): string {
  const start = toCalStamp(d.slotIso);
  const end = toCalStamp(eventEndIso(d.slotIso, d.cfg.duration));
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(d),
    dates: `${start}/${end}`,
    details: eventDescription(d),
    location: bookingLocationLabel(d.cfg),
  });
  // ホストを招待 (ゲストが保存すると Google からホストへ招待が届く)
  if (d.cfg.hostEmail) params.append('add', d.cfg.hostEmail);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** どのカレンダーアプリでも開ける .ics を生成 (Apple カレンダー / Outlook 等のフォールバック) */
export function buildIcs(d: BookingDetails): string {
  const uid = `${toCalStamp(d.slotIso)}-${(d.guestEmail || 'guest').replace(/[^a-z0-9]/gi, '')}@core-prism`;
  const esc = (s: string) => (s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CORE Prism//Booking//JA', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${toCalStamp(d.slotIso)}`,
    `DTEND:${toCalStamp(eventEndIso(d.slotIso, d.cfg.duration))}`,
    `SUMMARY:${esc(eventTitle(d))}`,
    `DESCRIPTION:${esc(eventDescription(d))}`,
    `LOCATION:${esc(bookingLocationLabel(d.cfg))}`,
    d.cfg.hostEmail ? `ORGANIZER;CN=${esc(d.cfg.host)}:mailto:${d.cfg.hostEmail}` : '',
    d.guestEmail ? `ATTENDEE;CN=${esc(d.guestName)};RSVP=TRUE:mailto:${d.guestEmail}` : '',
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}
