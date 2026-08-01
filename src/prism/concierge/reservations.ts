// ============================================================
// reservations — Crystal 予約管理
//
// どの経路の予約も1つの受信箱で扱う：チャット（Crystal が会話中に捕捉）/
// 公式LINE / メール / 電話 / 手動。お店ごと（conciergeSiteId の site）に保存する。
// 保存先は /api/crystal-reservations（Upstash 永続化）。
// ============================================================
import { fetchWithTimeout } from '../../lib/fetchWithTimeout';

export type ReservationSource = 'chat' | 'line' | 'email' | 'phone' | 'manual';
export type ReservationStatus = 'new' | 'confirmed' | 'done' | 'cancelled';

export interface Reservation {
  id: string;
  createdAt: string;                 // ISO
  name: string;                      // お客様名
  contact: string;                   // 連絡先（電話/メール/LINE名など自由記述）
  contactType?: 'phone' | 'email' | 'line' | 'other';
  whenText: string;                  // ご希望日時（自由記述。例「7/25 19:00」）
  service?: string;                  // メニュー/コース
  party?: number;                    // 人数
  note?: string;                     // 備考
  source: ReservationSource;
  status: ReservationStatus;
}

export type ReservationDraft = Omit<Reservation, 'id' | 'createdAt' | 'status'> & {
  status?: ReservationStatus;
};

export const SOURCE_LABEL: Record<ReservationSource, string> = {
  chat: 'チャット', line: '公式LINE', email: 'メール', phone: '電話', manual: '手動',
};
export const STATUS_LABEL: Record<ReservationStatus, string> = {
  new: '未確認', confirmed: '確定', done: '完了', cancelled: 'キャンセル',
};

const EP = '/api/crystal-reservations';

export interface ReservationsResult {
  ok: boolean;
  configured: boolean;   // サーバーが永続化対応（Upstash）か
  reservations: Reservation[];
  error?: string;
}

/** お店の予約一覧を取得（新しい順）。 */
export async function listReservations(site: string): Promise<ReservationsResult> {
  try {
    const res = await fetchWithTimeout(`${EP}?site=${encodeURIComponent(site)}`, {}, 15000);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, configured: !!j?.configured, reservations: [], error: j?.error || `HTTP ${res.status}` };
    return { ok: true, configured: !!j?.configured, reservations: Array.isArray(j?.reservations) ? j.reservations : [] };
  } catch {
    return { ok: false, configured: false, reservations: [], error: '通信が不安定なようです。もう一度お試しください。' };
  }
}

/**
 * 予約を1件追加した結果。
 *
 * 【2026-08-01 根治】以前は `Reservation | null` を返していた。
 * 保存先(Upstash)が未設定のとき、サーバーは正直に
 * `{ ok:true, persisted:false, configured:false }`（202）を返しているのに、
 * 呼び出し側は「reservation が無い＝失敗」としか受け取れず、
 * お客様には「通信環境をご確認ください」と出していた。
 * 通信は正常で、原因はこちらの設定漏れ。**お客様に自分のせいだと思わせ、予約は消える**。
 *
 * 成否を真偽値ひとつで返す関数は、理由を画面に出す道が型の時点で閉じている。
 * だから理由まで返す形にする。
 */
export type AddReservationResult =
  | { ok: true; reservation: Reservation }
  /** 通信は届いたが保存されていない（保存先が未設定）。予約は残っていない。 */
  | { ok: false; reason: 'not-persisted'; configured: false; hint?: string }
  /** サーバーが受け付けなかった（入力不足など）。 */
  | { ok: false; reason: 'rejected'; status: number; error?: string; hint?: string }
  /** そもそも届かなかった（回線・タイムアウト）。 */
  | { ok: false; reason: 'network' };

/** 予約を1件追加（チャット捕捉・手動追加の両方で使う）。 */
export async function addReservation(site: string, draft: ReservationDraft): Promise<AddReservationResult> {
  try {
    const res = await fetchWithTimeout(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site, reservation: draft }),
    }, 15000);
    const j = await res.json().catch(() => ({} as Record<string, unknown>));

    if (res.ok && j?.reservation) return { ok: true, reservation: j.reservation as Reservation };

    // 200/202 でも中身が空＝保存されていない。ここを「通信の失敗」と混ぜてはいけない。
    if (res.ok) {
      return { ok: false, reason: 'not-persisted', configured: false, hint: typeof j?.hint === 'string' ? j.hint : undefined };
    }
    return {
      ok: false,
      reason: 'rejected',
      status: res.status,
      error: typeof j?.error === 'string' ? j.error : undefined,
      hint: typeof j?.hint === 'string' ? j.hint : undefined,
    };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** 画面にそのまま出せる日本語にする（原因ごとに、次にどうすればよいかまで言う）。 */
export function addReservationMessage(r: Exclude<AddReservationResult, { ok: true }>, forOwner: boolean): string {
  switch (r.reason) {
    case 'not-persisted':
      return forOwner
        ? `保存先が未設定のため、予約が保存されていません。${r.hint ?? 'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN を設定してください。'}`
        : '申し訳ありません。ただいまご予約をお預かりできませんでした。お手数ですが、お電話またはメールでご連絡ください。';
    case 'rejected':
      return r.hint ?? '入力内容をご確認のうえ、もう一度お試しください。';
    case 'network':
      return '通信が届きませんでした。電波のよい場所で、もう一度お試しください。';
  }
}

/** 予約の状態を更新（確定/完了/キャンセル）。 */
export async function updateReservationStatus(site: string, id: string, status: ReservationStatus): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site, action: 'update', id, status }),
    }, 15000);
    return res.ok;
  } catch {
    return false;
  }
}
