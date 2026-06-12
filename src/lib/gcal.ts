// ============================================================
// Google カレンダー連携 — 隙間時間の把握 + 予定の自動登録
//   ・freeBusy で予定の埋まり具合を取得 → 営業時間内の空きスロットを算出
//   ・events.insert で隙間に会議を入れる
//   scope: calendar.readonly (空き確認) + calendar.events (登録)
// ============================================================
import { requestGoogleToken, getValidGoogleToken, loadGoogleToken, clearGoogleToken, isGoogleConnected } from './googleAuth';

const CAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];
const STORE = 'calendar';

export function isCalendarConnected(): boolean { return isGoogleConnected(STORE); }
export function disconnectCalendar() { clearGoogleToken(STORE); }
export async function connectCalendar(): Promise<void> { await requestGoogleToken(CAL_SCOPES, STORE); }

async function calFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = loadGoogleToken(STORE) || await getValidGoogleToken(CAL_SCOPES, STORE);
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 401) { clearGoogleToken(STORE); throw new Error('カレンダー認証の期限切れ。もう一度「連携」してください。'); }
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Calendar API ${res.status}: ${t.slice(0, 200)}`); }
  return res.json();
}

export interface BusyInterval { start: string; end: string; }
export interface FreeSlot { startISO: string; endISO: string; label: string; minutes: number; }

/** 指定期間の「埋まっている時間帯」を primary カレンダーから取得 */
export async function fetchBusy(timeMinISO: string, timeMaxISO: string): Promise<BusyInterval[]> {
  const data = await calFetch('/freeBusy', {
    method: 'POST',
    body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, items: [{ id: 'primary' }] }),
  });
  const busy = data?.calendars?.primary?.busy || [];
  return busy as BusyInterval[];
}

export interface FreeSlotOptions {
  days?: number;          // 今日から何日分 (default 5)
  workStartHour?: number; // 営業開始 (default 9)
  workEndHour?: number;   // 営業終了 (default 19)
  minMinutes?: number;    // 最小スロット (default 30)
  skipWeekends?: boolean; // 土日除外 (default true)
}

/** busy 区間から営業時間内の空きスロットを算出 */
export function computeFreeSlots(busy: BusyInterval[], opts: FreeSlotOptions = {}): FreeSlot[] {
  const days = opts.days ?? 5;
  const ws = opts.workStartHour ?? 9;
  const we = opts.workEndHour ?? 19;
  const minMs = (opts.minMinutes ?? 30) * 60_000;
  const skipWeekends = opts.skipWeekends ?? true;
  const busyRanges = busy.map(b => ({ s: new Date(b.start).getTime(), e: new Date(b.end).getTime() }))
    .sort((a, b) => a.s - b.s);
  const slots: FreeSlot[] = [];
  const now = Date.now();
  const base = new Date();
  for (let d = 0; d < days; d++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
    const dow = day.getDay();
    if (skipWeekends && (dow === 0 || dow === 6)) continue;
    let cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate(), ws, 0, 0).getTime();
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), we, 0, 0).getTime();
    if (cursor < now) cursor = Math.ceil(now / (30 * 60_000)) * (30 * 60_000); // 過去は今から
    // その日の busy だけ抽出
    const todays = busyRanges.filter(b => b.e > cursor && b.s < dayEnd);
    for (const b of todays) {
      if (b.s - cursor >= minMs) {
        slots.push(makeSlot(cursor, b.s));
      }
      cursor = Math.max(cursor, b.e);
    }
    if (dayEnd - cursor >= minMs) slots.push(makeSlot(cursor, dayEnd));
  }
  return slots;
}

function makeSlot(s: number, e: number): FreeSlot {
  const sd = new Date(s), ed = new Date(e);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][sd.getDay()];
  const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const minutes = Math.round((e - s) / 60_000);
  const label = `${sd.getMonth() + 1}/${sd.getDate()}(${wd}) ${hm(sd)}〜${hm(ed)}`;
  return { startISO: sd.toISOString(), endISO: ed.toISOString(), label, minutes };
}

/** 今後の予定（文脈用） */
export async function listUpcoming(maxResults = 10): Promise<{ summary: string; start: string; end: string }[]> {
  const nowISO = new Date().toISOString();
  const data = await calFetch(`/calendars/primary/events?timeMin=${encodeURIComponent(nowISO)}&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`);
  return (data.items || []).map((e: any) => ({
    summary: e.summary || '(無題)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
  }));
}

/** 隙間に予定を入れる */
export async function createEvent(opts: {
  summary: string; startISO: string; endISO: string; description?: string; attendees?: string[];
}): Promise<{ id: string; htmlLink: string }> {
  const body: any = {
    summary: opts.summary,
    start: { dateTime: opts.startISO, timeZone: 'Asia/Tokyo' },
    end: { dateTime: opts.endISO, timeZone: 'Asia/Tokyo' },
  };
  if (opts.description) body.description = opts.description;
  if (opts.attendees?.length) body.attendees = opts.attendees.map(email => ({ email }));
  const data = await calFetch('/calendars/primary/events?sendUpdates=all', { method: 'POST', body: JSON.stringify(body) });
  return { id: data.id, htmlLink: data.htmlLink };
}

/** 今日〜days日分の隙間時間をまとめて取得 */
export async function getFreeSlots(opts: FreeSlotOptions = {}): Promise<FreeSlot[]> {
  const days = opts.days ?? 5;
  const now = new Date();
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59);
  const busy = await fetchBusy(now.toISOString(), max.toISOString());
  return computeFreeSlots(busy, opts);
}
