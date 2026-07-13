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

/** 予約を1件追加（チャット捕捉・手動追加の両方で使う）。成功したら作成された Reservation を返す。 */
export async function addReservation(site: string, draft: ReservationDraft): Promise<Reservation | null> {
  try {
    const res = await fetchWithTimeout(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site, reservation: draft }),
    }, 15000);
    const j = await res.json().catch(() => ({}));
    return res.ok && j?.reservation ? (j.reservation as Reservation) : null;
  } catch {
    return null;
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
