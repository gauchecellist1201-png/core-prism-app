// ============================================================
// 予約の受信箱 — 相手が選んだ日時を、ホストの Prism 画面まで届ける
//
// これまで日程調整リンク (?book=…) は完全に URL 内で完結していて、
// 相手が予約しても Prism 側には何も残らなかった。気づけるのは Google の招待メールだけ。
// リンクを作るときに受信箱 ID を1つ埋め込み、押された時点で1件送る。
//
// 正直さのルール: ここに届くのは「相手が予約ボタンを押した」記録であって、
// 相手が Google カレンダーで保存し切ったかまでは分からない。画面には必ずそう書く。
// ============================================================
import type { BookingConfig } from '../types/scheduling';

const INBOX_KEY = 'prism.booking.inbox';
const OWNER_KEY = 'prism.booking.key';
const API = '/api/meeting-bookings';
const TIMEOUT_MS = 8000;

export interface InboxBooking {
  id: string;
  receivedAt: string;
  slotIso: string;
  durationMin: number;
  meetingName: string;
  guestName: string;
  guestEmail: string;
  location?: string;
  personaName?: string;
  personaColor?: string;
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 受信箱 ID と、ホストだけが持つ鍵。
 * ID はゲストに配る URL に入る＝公開値。鍵は URL に入れず、この端末にだけ置く。
 * 鍵が無いと一覧は読めない（他のゲストの氏名・メールを守るため）。
 */
export function getOrCreateInbox(): { id: string; key: string } {
  try {
    const curId = localStorage.getItem(INBOX_KEY);
    const curKey = localStorage.getItem(OWNER_KEY);
    if (curId && /^b[a-f0-9]{16}$/i.test(curId) && curKey && /^[a-f0-9]{32}$/i.test(curKey)) {
      return { id: curId, key: curKey };
    }
    const id = 'b' + randomHex(8);
    const key = randomHex(16);
    localStorage.setItem(INBOX_KEY, id);
    localStorage.setItem(OWNER_KEY, key);
    return { id, key };
  } catch {
    // localStorage が使えない環境 (プライベートモード等)。
    // 保存できない ID を配るとリンクを作り直すたび受信箱が変わるので、その回限りと割り切る。
    return { id: 'b' + randomHex(8), key: randomHex(16) };
  }
}

/** 既にある受信箱 (無ければ null)。読むだけで新規発行しない。 */
export function peekInbox(): { id: string; key: string } | null {
  try {
    const id = localStorage.getItem(INBOX_KEY);
    const key = localStorage.getItem(OWNER_KEY);
    if (id && /^b[a-f0-9]{16}$/i.test(id) && key && /^[a-f0-9]{32}$/i.test(key)) return { id, key };
    return null;
  } catch {
    return null;
  }
}

/**
 * 受信箱の持ち主として登録する。リンクを作る側が、URL を配る前に呼ぶ。
 * 失敗しても予約リンク自体は成立するので、リンク作成は止めない。
 */
export async function claimInbox(inbox: { id: string; key: string }): Promise<void> {
  try {
    await req({
      url: API,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inbox: inbox.id, action: 'register', key: inbox.key }),
    });
  } catch {
    /* 次に一覧を読むときにも同じ鍵で確保を試みる（GET 側でも先着確保する） */
  }
}

async function req(init: RequestInit & { url: string }): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(init.url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ゲストが予約を押した瞬間に1件送る。
 * 送れたかどうかを必ず返す (黙って捨てない)。ゲスト画面の文言を分けるために使う。
 */
export async function sendBooking(
  cfg: BookingConfig,
  d: { slotIso: string; guestName: string; guestEmail: string; locationLabel: string },
): Promise<{ delivered: boolean }> {
  const inbox = (cfg as BookingConfig & { inbox?: string }).inbox;
  if (!inbox) return { delivered: false };
  try {
    const res = await req({
      url: API,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inbox,
        booking: {
          slotIso: d.slotIso,
          durationMin: cfg.duration,
          meetingName: cfg.meetingName,
          guestName: d.guestName,
          guestEmail: d.guestEmail,
          location: d.locationLabel,
          personaName: cfg.personaName,
          personaColor: cfg.personaColor,
        },
      }),
    });
    const j = await res.json().catch(() => null);
    return { delivered: !!(res.ok && j?.persisted) };
  } catch {
    return { delivered: false };
  }
}

export type InboxState =
  | { phase: 'off' }                                            // まだリンクを1本も作っていない
  | { phase: 'ok'; bookings: InboxBooking[]; seenAt: string | null }
  | { phase: 'unconfigured' }                                   // 保存先が未設定 (運用側の設定待ち)
  | { phase: 'error'; message: string };

/** 受信箱を読む。失敗は握りつぶさず error として返す (欄ごと消さない)。 */
export async function loadInbox(): Promise<InboxState> {
  const inbox = peekInbox();
  if (!inbox) return { phase: 'off' };
  try {
    const res = await req({ url: `${API}?inbox=${encodeURIComponent(inbox.id)}&key=${encodeURIComponent(inbox.key)}` });
    const j = await res.json().catch(() => null);
    if (res.status === 403) {
      // 受信箱の持ち主が別端末。つながらないのとは原因が違うので、そう書く。
      return {
        phase: 'error',
        message: 'この受信箱は別の端末のものです。予約リンクを作った端末で開いてください。',
      };
    }
    if (!res.ok || !j?.ok) {
      return { phase: 'error', message: 'いまサーバーにつながりませんでした。' };
    }
    if (j.configured === false) return { phase: 'unconfigured' };
    const bookings: InboxBooking[] = Array.isArray(j.bookings) ? j.bookings : [];
    return { phase: 'ok', bookings, seenAt: j.seenAt ?? null };
  } catch {
    return { phase: 'error', message: '通信が届きませんでした。電波の良いところで、もう一度お試しください。' };
  }
}

/** 「見た」を記録。失敗しても画面は止めない (バッジが残るだけ)。 */
export async function markInboxSeen(): Promise<void> {
  const inbox = peekInbox();
  if (!inbox) return;
  try {
    await req({
      url: API,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inbox: inbox.id, action: 'seen', key: inbox.key }),
    });
  } catch {
    /* 既読は付けられなかっただけ。次に開けばまた新着として出る＝見落としは増えない */
  }
}

/** 未読件数 (最後に見た時刻より後に届いた分)。 */
export function unreadCount(bookings: InboxBooking[], seenAt: string | null): number {
  if (!seenAt) return bookings.length;
  const t = new Date(seenAt).getTime();
  if (Number.isNaN(t)) return bookings.length;
  return bookings.filter(b => new Date(b.receivedAt).getTime() > t).length;
}
