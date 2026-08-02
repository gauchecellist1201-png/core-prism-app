// ============================================================
// /api/status — 公開ステータス エンドポイント (認証なし)
//
// 2026-08-03 作り直し:
//   旧版は「鍵の疎通チェック (Anthropic / Stripe / Resend)」を直列で叩き、
//   さらに Upstash へ 90 回 連続で HGETALL していたため **応答に 22 秒** かかっていた。
//   /status ページ側のタイムアウトは 12 秒なので、実際には**必ず失敗**していたのに
//   ページは「すべて正常」と出していた (＝嘘の緑)。
//
//   作り直しの方針:
//   1. お客様が知りたいのは「いま CORE の 7 つのサービスが開けるか」なので、
//      本番 URL を **実際に取りに行って** 生死を測る (実測しかしない)
//   2. すべて **並列** + 6 秒で打ち切り → 全体で 3 秒以内に返す
//   3. 測れなかったものは "unknown"。**測れていないものを「正常」と言わない**
//   4. 障害の記録は Upstash を **1 回の pipeline** で読む (90 往復をやめる)
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';

// 障害の記録を取り始めた日。これより前の「無事故」は主張しない
const RECORDING_SINCE = '2026-08-03';

// 公開している 7 つのサービス (/corp の「七つのプロダクト」と同じ並び)
const SERVICES: { name: string; url: string; what: string }[] = [
  { name: 'CORE Prism',    url: 'https://core-prism-app.vercel.app/',           what: '経営のAI参謀' },
  { name: 'CORE Iris',     url: 'https://core-prism-app.vercel.app/iris',       what: 'リール制作' },
  { name: 'CORE Guild',    url: 'https://guild-hazel.vercel.app/',              what: '集まって決める場' },
  { name: 'CORE Resonance',url: 'https://resonancebot-ivory.vercel.app/lp',     what: 'LINE集客' },
  { name: 'CORE Lume',     url: 'https://lume-deploy-five.vercel.app/',         what: 'リンクをひとつに' },
  { name: 'CORE Crystal',  url: 'https://crystal-nine-self.vercel.app/',        what: '電話とチャットのAI' },
  { name: 'CORE Pulse',    url: 'https://core-prism-app.vercel.app/pulse',      what: '見守り' },
  { name: 'CORE 本体サイト', url: 'https://core-prism-app.vercel.app/corp',      what: '会社のご案内' },
];

interface PublicService { name: string; what: string; ok: boolean | null; latencyMs: number | null; note: string }
interface Incident { date: string; title: string; status: 'investigating' | 'monitoring' | 'resolved'; minutesDown?: number }

async function probe(s: { name: string; url: string; what: string }): Promise<PublicService> {
  const start = Date.now();
  try {
    const res = await fetch(s.url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'CORE-StatusBot/1.0 (+https://core-prism-app.vercel.app/status)' },
      signal: AbortSignal.timeout(6000),
    });
    const ms = Date.now() - start;
    if (!res.ok) {
      return { name: s.name, what: s.what, ok: false, latencyMs: ms, note: `開けませんでした (HTTP ${res.status})` };
    }
    return { name: s.name, what: s.what, ok: true, latencyMs: ms, note: '開けました' };
  } catch {
    // 時間切れ / 接続できない
    return { name: s.name, what: s.what, ok: null, latencyMs: null, note: '今回は確認できませんでした' };
  }
}

function parseHash(arr: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i + 1 < arr.length; i += 2) out[String(arr[i])] = String(arr[i + 1]);
  return out;
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** 直近 90 日の障害記録を pipeline 1 回で読む。読めなければ null (＝「無事故」とは言わない) */
async function loadIncidents(): Promise<Incident[] | null> {
  if (!UP_URL || !UP_TOK) return null;
  const dates = Array.from({ length: 90 }, (_, i) => dateOffsetDays(i));
  try {
    const res = await fetch(`${UP_URL.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(dates.map((d) => ['HGETALL', `incident:${d}`])),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const rows = await res.json() as { result?: unknown }[];
    if (!Array.isArray(rows)) return null;
    const out: Incident[] = [];
    rows.forEach((row, i) => {
      const h = parseHash(row?.result);
      if (!h.title) return;
      out.push({
        date: dates[i],
        title: h.title,
        status: (h.status || 'resolved') as Incident['status'],
        minutesDown: h.minutesDown ? Number(h.minutesDown) : undefined,
      });
    });
    return out;
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    } });
  }
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

  const [services, incidents] = await Promise.all([
    Promise.all(SERVICES.map(probe)),
    loadIncidents(),
  ]);

  const down = services.filter((s) => s.ok === false).length;
  const unknown = services.filter((s) => s.ok === null).length;
  const overall: 'operational' | 'degraded' | 'major_outage' | 'unknown' =
    down === 0 && unknown === 0 ? 'operational'
    : down >= 2 ? 'major_outage'
    : down === 1 ? 'degraded'
    : 'unknown'; // 落ちてはいないが、確認できなかったものがある

  return new Response(JSON.stringify({
    asOf: new Date().toISOString(),
    overall,
    services,
    incidents: incidents || [],
    incidentsKnown: incidents !== null,
    recordingSince: RECORDING_SINCE,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=180',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
