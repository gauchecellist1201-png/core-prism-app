// ============================================================
// /api/track/roai — 全社共通の導線ビーコン受信口
//
// 元々は /corp と CORE ROAI SCORE 専用だったが、計測の語彙が
// corp / studio / NERI LP で3つに割れていて全社の母数が出せなかったため、
// ここを共通の受け口にした（_taxonomy.ts が語彙の正本）。
//
// POST { site?, event, label? }
//   - site 省略時は 'corp'（従来どおりの呼び出しを壊さない）
//   - event は「サイト固有の旧名」か「共通語彙」のどちらでもよい
//   - 旧名は今までどおり roai:funnel:<date> にも積む（既存画面の互換）
//   - 共通語彙へ変換できるものは core:funnel:<date> にも積む
//   - Content-Type は application/json / text/plain の両方（他ドメインからの
//     ビーコンを preflight 無しで受けるため）
// GET  ?days=14&master_key=…            — roai:funnel の生カウント（従来）
// GET  ?scope=core&days=30&master_key=… — core:funnel の生カウント（全社）
//
// 個人情報は受け取らない（label は英数字 40 文字に丸める）。
// ============================================================
import {
  CORE_EVENTS,
  coreFunnelCommands,
  coreFunnelKey,
  isCoreEvent,
  isCoreSite,
  isServerOnly,
  sanitizeLabel,
} from './_taxonomy';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);
const MASTER_KEY = (typeof process !== 'undefined' && process.env?.MASTER_KEY) || 'GAUCHE2026';

// src/corporate/roai/track.ts の ROAI_EVENTS と揃える
export const ROAI_EVENTS = [
  'corp_page_view', 'corp_cta_click',
  'roai_view', 'roai_start', 'roai_step', 'roai_back', 'roai_resume', 'roai_complete',
  'roai_result_view', 'roai_basis_open', 'roai_report_request', 'roai_consult_click', 'roai_consult_submit', 'roai_restart',
] as const;
const EVENT_SET = new Set<string>(ROAI_EVENTS);

/** 他ドメイン（NERI LP など）からのビーコンを受ける許可リスト */
const ALLOWED_ORIGINS = [
  'https://www.core-ai.jp',
  'https://core-ai.jp',
  'https://nexus.core-ai.jp',
  'https://neri.core-ai.jp',
  'https://core-nexus-kappa.vercel.app',
  'https://core-prism-app.vercel.app',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const ok = origin && (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin));
  if (!ok) return {};
  return {
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export { sanitizeLabel };

async function up(cmd: (string | number)[]): Promise<unknown> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

/** 複数コマンドを1往復で送る（1回のビーコンで4〜5回 fetch しないため） */
async function upPipeline(cmds: (string | number)[][]): Promise<void> {
  if (!UPSTASH_OK || cmds.length === 0) return;
  const res = await fetch(`${UP_URL.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** 日付ごとの HGETALL をまとめて読む */
async function readDays(prefix: string, days: number): Promise<Array<{ date: string; counts: Record<string, number> }>> {
  const list: Array<{ date: string; counts: Record<string, number> }> = [];
  for (let i = 0; i < days; i++) {
    const d = dateOffsetDays(i);
    try {
      const r = await up(['HGETALL', `${prefix}${d}`]);
      const arr: string[] = (r as { result?: string[] }).result || [];
      const counts: Record<string, number> = {};
      for (let j = 0; j < arr.length; j += 2) counts[arr[j]] = Number(arr[j + 1]) || 0;
      list.push({ date: d, counts });
    } catch { list.push({ date: d, counts: {} }); }
  }
  return list.reverse();
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
    if (key !== MASTER_KEY) return json({ error: 'forbidden' }, 403);
    const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') || '14')));
    const core = url.searchParams.get('scope') === 'core';
    if (!UPSTASH_OK) return json({ ok: true, configured: false, scope: core ? 'core' : 'roai', days: [] });
    const list = await readDays(core ? 'core:funnel:' : 'roai:funnel:', days);
    if (!core) return json({ ok: true, configured: true, days: list });

    // 全社スコープでは「合計」も一緒に返す（読む側で足し直さなくていいように）
    const totals: Record<string, number> = {};
    for (const d of list) for (const [f, n] of Object.entries(d.counts)) totals[f] = (totals[f] || 0) + n;
    return json({ ok: true, configured: true, scope: 'core', events: CORE_EVENTS, days: list, totals });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);

  // text/plain でも受ける（他ドメインからの sendBeacon を preflight 無しで通すため）
  let body: { site?: string; event?: string; label?: string };
  try { body = JSON.parse(await req.text()) as typeof body; } catch { body = {}; }
  const event = String(body.event || '');
  const site = String(body.site || 'corp');
  if (!isCoreSite(site)) return json({ ok: false, error: 'invalid_site' }, 400, cors);
  const known = EVENT_SET.has(event) || isCoreEvent(event);
  if (!known) return json({ ok: false, error: 'invalid_event' }, 400, cors);
  // 決済の確定はサーバー（Stripe webhook）だけが積む。ここで受けると誰でも
  // 「買われた」を増やせてしまう。
  if (isServerOnly(site, event)) return json({ ok: false, error: 'server_only' }, 400, cors);
  const label = sanitizeLabel(body.label);

  if (UPSTASH_OK) {
    const cmds: (string | number)[][] = [];
    // 従来の corp 側ハッシュ（既存画面の互換。共通語彙だけの新イベントは積まない）
    if (EVENT_SET.has(event)) {
      const legacyKey = `roai:funnel:${new Date().toISOString().slice(0, 10)}`;
      cmds.push(['HINCRBY', legacyKey, event, 1]);
      if (label) cmds.push(['HINCRBY', legacyKey, `${event}:${label}`, 1]);
      cmds.push(['EXPIRE', legacyKey, 400 * 86400]);
    }
    // 全社共通ハッシュ
    cmds.push(...coreFunnelCommands(site, event, label));
    try {
      await upPipeline(cmds);
    } catch (e) {
      console.error('[core-funnel] upstash error', (e as Error).message);
    }
  } else {
    console.log(`[core-funnel] ${site} ${event}${label ? `:${label}` : ''} (${coreFunnelKey()})`);
  }
  return json({ ok: true }, 200, cors);
}
