// ============================================================
// /api/meeting-bookings — 日程調整リンク (?book=…) で相手が選んだ日時の受信箱
//
// これまで予約は「ゲストの Google カレンダーが開く → ホストへ招待メール」だけで完結し、
// Prism の画面には一切出てこなかった。メールを見落とすと気づけない＝成果が届かない。
// ここに1件ずつ積んで、ホスト側 (MeetingHub) が読めるようにする。
//
// 受信箱 ID はゲストに配る URL に入る＝公開値。誰でも読めてしまうと他のゲストの
// 氏名/メールが漏れるので、**読み出しにはホストだけが持つ鍵 (key) を要求する**。
// 鍵はリンクを作った端末の localStorage にだけ置き、URL には絶対に入れない。
//
// GET  ?inbox=b<16hex>&key=<32hex>    → { ok, configured, bookings: [...] }  (鍵必須)
// POST { inbox, action:'register', key } → 受信箱の持ち主を登録 (先着1回)
// POST { inbox, booking }             → 1件追加 (鍵不要。ゲストが押した記録)
// POST { inbox, key, action:'seen' }  → 既読時刻を更新 (鍵必須)
//
// Upstash key (TTL 180日):
//   prism:booking:<inbox>       (String) — 予約の JSON 配列 (最大200件)
//   prism:booking:<inbox>:seen  (String) — 最後に見た時刻 (ISO)
//   prism:booking:<inbox>:key   (String) — ホストの鍵 (SETNX で先着固定)
//
// 注意 (数字の嘘ゼロ): ここに入るのは「ゲストが予約ボタンを押した」時点の記録であって、
// ゲストが Google カレンダーで実際に保存したかまでは分からない。表示側で必ずそう書く。
// ============================================================
export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);
const TTL_SEC = 180 * 24 * 60 * 60;
const MAX = 200;

async function up(cmd: (string | number)[]): Promise<any> {
  if (!OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });
}

const INBOX_RE = /^b[a-f0-9]{16}$/i;
const KEY_RE = /^[a-f0-9]{32}$/i;

function key(inbox: string): string { return `prism:booking:${inbox.toLowerCase()}`; }
function seenKey(inbox: string): string { return `${key(inbox)}:seen`; }
function ownerKey(inbox: string): string { return `${key(inbox)}:key`; }

/** 鍵が受信箱の持ち主のものか。未登録なら「その鍵で確保する」（先着＝リンクを作った本人）。 */
async function authorize(inbox: string, presented: string): Promise<boolean> {
  if (!KEY_RE.test(presented)) return false;
  const cur = await up(['GET', ownerKey(inbox)]);
  if (!cur?.result) {
    await up(['SET', ownerKey(inbox), presented.toLowerCase(), 'NX', 'EX', TTL_SEC]);
    const after = await up(['GET', ownerKey(inbox)]);
    return String(after?.result || '') === presented.toLowerCase();
  }
  return String(cur.result) === presented.toLowerCase();
}

function str(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

interface Booking {
  id: string;
  receivedAt: string;      // Prism が受け取った時刻
  slotIso: string;         // 相手が選んだ開始日時
  durationMin: number;
  meetingName: string;
  guestName: string;
  guestEmail: string;
  location?: string;
  personaName?: string;
  personaColor?: string;
}

function rid(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return 'bk_' + Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitize(raw: any): Booking | null {
  if (!raw || typeof raw !== 'object') return null;
  const slotIso = str(raw.slotIso, 40);
  // 日時が読めない予約は受け取っても意味がない（空行が増えるだけ）ので弾く
  if (!slotIso || Number.isNaN(new Date(slotIso).getTime())) return null;
  const durN = Number(raw.durationMin);
  return {
    id: rid(),
    receivedAt: new Date().toISOString(),
    slotIso: new Date(slotIso).toISOString(),
    durationMin: Number.isFinite(durN) && durN > 0 && durN <= 600 ? Math.round(durN) : 30,
    meetingName: str(raw.meetingName, 120) || 'ミーティング',
    guestName: str(raw.guestName, 60),
    guestEmail: str(raw.guestEmail, 120),
    location: str(raw.location, 80) || undefined,
    personaName: str(raw.personaName, 60) || undefined,
    personaColor: str(raw.personaColor, 20) || undefined,
  };
}

async function loadAll(inbox: string): Promise<Booking[]> {
  const r = await up(['GET', key(inbox)]);
  if (!r?.result) return [];
  try {
    const parsed = JSON.parse(r.result);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const inbox = url.searchParams.get('inbox') || '';
    const presented = url.searchParams.get('key') || '';
    if (!INBOX_RE.test(inbox)) return json({ ok: false, error: 'invalid_inbox' }, 400);
    if (!KEY_RE.test(presented)) return json({ ok: false, error: 'key_required' }, 400);
    if (!OK) return json({ ok: true, configured: false, bookings: [], seenAt: null });
    // 失敗は握りつぶさない。画面に「読み込めませんでした」を出させる。
    try {
      if (!(await authorize(inbox, presented))) return json({ ok: false, error: 'forbidden' }, 403);
      const [list, seen] = await Promise.all([loadAll(inbox), up(['GET', seenKey(inbox)])]);
      return json({ ok: true, configured: true, bookings: list, seenAt: seen?.result || null });
    } catch {
      return json({ ok: false, error: 'store_unavailable' }, 503);
    }
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const inbox = str(body?.inbox, 40);
  if (!INBOX_RE.test(inbox)) return json({ ok: false, error: 'invalid_inbox' }, 400);

  if (!OK) {
    // 受け取ったふりはしない。ゲスト側は「ホストの画面には出ません」と正直に出す。
    return json({ ok: true, persisted: false, configured: false, hint: 'UPSTASH_REDIS_REST_URL/TOKEN を設定すると予約が Prism に届きます。' }, 202);
  }

  // 受信箱の持ち主を登録（リンクを作った瞬間に呼ぶ。ゲストに渡る前に押さえる）
  if (body?.action === 'register') {
    const presented = str(body?.key, 40);
    if (!KEY_RE.test(presented)) return json({ ok: false, error: 'key_required' }, 400);
    try {
      const owned = await authorize(inbox, presented);
      return owned ? json({ ok: true, owned: true }) : json({ ok: false, error: 'forbidden' }, 403);
    } catch {
      return json({ ok: false, error: 'store_unavailable' }, 503);
    }
  }

  if (body?.action === 'seen') {
    const presented = str(body?.key, 40);
    if (!KEY_RE.test(presented)) return json({ ok: false, error: 'key_required' }, 400);
    try {
      if (!(await authorize(inbox, presented))) return json({ ok: false, error: 'forbidden' }, 403);
      await up(['SET', seenKey(inbox), new Date().toISOString(), 'EX', TTL_SEC]);
      return json({ ok: true });
    } catch {
      return json({ ok: false, error: 'store_unavailable' }, 503);
    }
  }

  const bk = sanitize(body?.booking);
  if (!bk) return json({ ok: false, error: 'bad_booking' }, 422);
  try {
    const list = await loadAll(inbox);
    list.unshift(bk);
    await up(['SET', key(inbox), JSON.stringify(list.slice(0, MAX)), 'EX', TTL_SEC]);
    return json({ ok: true, persisted: true, booking: bk });
  } catch {
    return json({ ok: false, error: 'store_unavailable' }, 503);
  }
}
