// ============================================================
// 空き時間計算 + Booking URL エンコード/デコード
// ============================================================
import type { AvailabilityRules, BookingConfig } from '../types/scheduling';
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
