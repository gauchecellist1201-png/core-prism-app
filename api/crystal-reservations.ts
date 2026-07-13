// ============================================================
// /api/crystal-reservations — Crystal 予約管理 (Upstash 永続化)
//
// どの経路の予約も1つの受信箱で。チャット(Crystalが会話中に捕捉)/公式LINE/
// メール/電話/手動 を、お店ごと(site)にまとめて保存・管理する。
//
// GET  ?site=...                         → { ok, configured, reservations: [...] }
// POST { site, reservation }             → 予約を1件追加 (新しい順の先頭へ)
// POST { site, action:'update', id, status } → 予約の状態を更新 (確定/完了/キャンセル)
//
// Upstash key (TTL 180日):
//   crystal:resv:<site>  (String)  — 予約の JSON 配列 (最大300件)
// ============================================================
export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);
const TTL_SEC = 180 * 24 * 60 * 60;
const MAX = 300;

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

const SITE_RE = /^c[a-f0-9]{16}$/i;
const SOURCES = ['chat', 'line', 'email', 'phone', 'manual'];
const STATUSES = ['new', 'confirmed', 'done', 'cancelled'];
const CONTACT_TYPES = ['phone', 'email', 'line', 'other'];

function key(site: string): string { return `crystal:resv:${site}`; }

function str(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

interface Reservation {
  id: string; createdAt: string; name: string; contact: string;
  contactType?: string; whenText: string; service?: string; party?: number;
  note?: string; source: string; status: string;
}

/** ランダムID (crypto)。Date.now は edge で使えるので createdAt 用に併用。 */
function rid(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return 'r_' + Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitize(raw: any): Reservation | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = str(raw.name, 60);
  const whenText = str(raw.whenText, 80);
  const contact = str(raw.contact, 120);
  // 名前 or 連絡先 or 希望日時 のどれかは必須（空予約を弾く）
  if (!name && !contact && !whenText) return null;
  const source = SOURCES.includes(raw.source) ? raw.source : 'manual';
  const status = STATUSES.includes(raw.status) ? raw.status : 'new';
  const contactType = CONTACT_TYPES.includes(raw.contactType) ? raw.contactType : undefined;
  const partyN = Number(raw.party);
  const party = Number.isFinite(partyN) && partyN > 0 && partyN <= 999 ? Math.round(partyN) : undefined;
  return {
    id: str(raw.id, 40) || rid(),
    createdAt: str(raw.createdAt, 40) || new Date().toISOString(),
    name, contact, contactType, whenText,
    service: str(raw.service, 80) || undefined,
    party,
    note: str(raw.note, 300) || undefined,
    source, status,
  };
}

async function loadAll(site: string): Promise<Reservation[]> {
  try {
    const r = await up(['GET', key(site)]);
    if (!r?.result) return [];
    const parsed = JSON.parse(r.result);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(site: string, list: Reservation[]): Promise<void> {
  await up(['SET', key(site), JSON.stringify(list.slice(0, MAX)), 'EX', TTL_SEC]);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const site = url.searchParams.get('site') || '';
    if (!SITE_RE.test(site)) return json({ ok: false, error: 'invalid_site' }, 400);
    if (!OK) return json({ ok: true, configured: false, reservations: [] });
    const list = await loadAll(site);
    return json({ ok: true, configured: true, reservations: list });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const site = str(body?.site, 40);
  if (!SITE_RE.test(site)) return json({ ok: false, error: 'invalid_site' }, 400);

  if (!OK) {
    // 受領はするが永続化しない（運用者向け案内）。
    return json({ ok: true, persisted: false, configured: false, hint: 'UPSTASH_REDIS_REST_URL/TOKEN を設定すると予約が保存されます。' }, 202);
  }

  // 状態更新
  if (body?.action === 'update') {
    const id = str(body?.id, 40);
    const status = STATUSES.includes(body?.status) ? body.status : '';
    if (!id || !status) return json({ ok: false, error: 'bad_update' }, 422);
    const list = await loadAll(site);
    const idx = list.findIndex((r) => r?.id === id);
    if (idx < 0) return json({ ok: false, error: 'not_found' }, 404);
    list[idx] = { ...list[idx], status };
    await saveAll(site, list);
    return json({ ok: true, reservation: list[idx] });
  }

  // 追加
  const resv = sanitize(body?.reservation);
  if (!resv) return json({ ok: false, error: 'empty_reservation', hint: '名前・連絡先・ご希望日時のいずれかを入れてください。' }, 422);
  const list = await loadAll(site);
  list.unshift(resv); // 新しい順
  await saveAll(site, list);
  return json({ ok: true, persisted: true, reservation: resv });
}
