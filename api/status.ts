// ============================================================
// /api/status — 公開ステータス エンドポイント (認証なし)
//
// オーナー指示 (2026-06-04 第 29 波 WWWW):
//   /status (公開ページ) が叩く。FFF /master/secrets-health は master key
//   が必要だが、こちらは「サービスの ON/OFF / 直近の生死」だけ返す。
//   キー値・サブスク名は一切含めない (Trust v3 と整合)。
//
// レスポンス例:
//   {
//     asOf: "2026-06-04T03:00:00Z",
//     services: [
//       { name: "Anthropic Claude", ok: true, latencyMs: 240, note: "model 取得 OK" },
//       { name: "Stripe", ok: true, latencyMs: 180, note: "live, charges=ON" },
//       …
//     ],
//     incidents: [{ date: "2026-05-15", title: "Stripe 遅延 30 分", status: "resolved" }]
//   }
//
// Upstash: incident:<date> ハッシュ (title / status / minutesDown) を直近 90 日分 走査
// ============================================================

export const config = { runtime: 'edge' };

import { runSecretsHealth } from './_lib/secretsHealth';

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';

async function upstash(cmd: (string | number)[]): Promise<any> {
  if (!UP_URL || !UP_TOK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function parseHash(res: any): Record<string, string> {
  const out: Record<string, string> = {};
  const arr = res?.result;
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i + 1 < arr.length; i += 2) {
    out[String(arr[i])] = String(arr[i + 1]);
  }
  return out;
}

interface PublicService { name: string; ok: boolean | null; latencyMs: number | null; note: string; }
interface Incident { date: string; title: string; status: 'investigating' | 'monitoring' | 'resolved'; minutesDown?: number; }

export default async function handler(req: Request): Promise<Response> {
  // 公開 — CORS 全許可、GET のみ
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    } });
  }
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // health: 内部の secretsHealth を 叩くが 値はマスク + キー名公開しない
  let services: PublicService[] = [];
  try {
    const sh = await runSecretsHealth();
    services = sh.checks
      // 「公開して問題ないサービス名」のみ並べる (env キー名は外に出さない)
      .filter((c) => ['Anthropic Claude', 'Stripe', 'Resend', 'Gemini', 'Upstash', 'Slack Webhook', 'X (Twitter)', 'VAPID (Web Push)'].includes(c.label))
      .map((c) => ({
        name: c.label,
        ok: c.reachOk,
        latencyMs: c.reachLatencyMs,
        // 詳細な「URL 形式 OK」 などは外向きでは丸める
        note: c.reachOk === false ? '不調' : c.reachOk === true ? 'OK' : '未設定',
      }));
  } catch {
    // secretsHealth で例外 — vercel build 時はキー無しなので
    services = [];
  }

  // incidents: 直近 90 日 を 1 日ずつ HGETALL (キャッシュ 5 分)
  const incidents: Incident[] = [];
  if (UP_URL && UP_TOK) {
    try {
      for (let i = 0; i < 90; i++) {
        const date = dateOffsetDays(i);
        const r = await upstash(['HGETALL', `incident:${date}`]);
        const h = parseHash(r);
        if (!h.title) continue;
        const status = (h.status || 'resolved') as Incident['status'];
        incidents.push({
          date,
          title: h.title,
          status,
          minutesDown: h.minutesDown ? Number(h.minutesDown) : undefined,
        });
      }
    } catch {
      // upstash 無設定 / エラーは無視 (公開ページは ok 表示が大事)
    }
  }

  // 全体ステータス (OK / 一部劣化 / 障害)
  const downs = services.filter((s) => s.ok === false).length;
  const overall = downs === 0 ? 'operational' : downs <= 1 ? 'degraded' : 'major_outage';

  return new Response(JSON.stringify({
    asOf: new Date().toISOString(),
    overall,
    services,
    incidents,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120, s-maxage=120, stale-while-revalidate=240',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
