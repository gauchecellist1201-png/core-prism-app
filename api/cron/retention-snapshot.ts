// ============================================================
// /api/cron/retention-snapshot — 毎日 6 UTC リテンション スナップ
//
// オーナー指示 (2026-06-04 第 34 波 MMMMM):
//   Upstash の active:<date> セット を元に、当日 DAU / 7 日 アクティブ /
//   30 日 アクティブ を 算出 → retention:snap:<date> ハッシュに保存。
//   週次 push (weekly-push) で 取り回しやすい形に。
//
// Vercel Cron 設定 (vercel.json):
//   "crons": [{ "path": "/api/cron/retention-snapshot", "schedule": "0 6 * * *" }]
//   ※ UTC 6:00 = JST 15:00 (リテンション計測結果が安定する時刻)
//
// 必要な env:
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  — KPI ソース
//   CRON_SECRET (任意)                                  — Bearer 検証
//
// 保存先 (Upstash):
//   retention:snap:<date>   Hash
//     dau          (前日 = ?date or 今日)
//     wau          (直近 7 日 unique)
//     mau          (直近 30 日 unique)
//     ret7dPct     (1 週間前 DAU 集合 と 今日 DAU 集合 の 重なり率)
//     newDevices   (新規端末 = 今日 active で 過去 30 日に出てきていない)
//     ts           (snapshot 時刻 ISO)
//
//   GET ?date=YYYY-MM-DD で 単発実行 + 結果確認も可能
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);

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
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function dateOffsetDays(daysAgo: number, base: Date = new Date()): string {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function scard(key: string): Promise<number> {
  try {
    const r = await up(['SCARD', key]);
    return Number((r as { result?: number }).result || 0);
  } catch { return 0; }
}

/** SUNIONSTORE して カウント → 一時セットを 5 分 TTL で 残す (再利用と掃除を兼ねる) */
async function sunionCount(tmpKey: string, sources: string[]): Promise<number> {
  if (sources.length === 0) return 0;
  try {
    await up(['SUNIONSTORE', tmpKey, sources.length, ...sources]);
    await up(['EXPIRE', tmpKey, 300]);
    return await scard(tmpKey);
  } catch { return 0; }
}

/** SINTERSTORE して 重なり率 */
async function ret7dRate(baseDate: string, refDate: string): Promise<number> {
  const tmp = `tmp:ret7d:${baseDate}:${refDate}`;
  try {
    await up(['SINTERSTORE', tmp, 2, `active:${baseDate}`, `active:${refDate}`]);
    const inter = await scard(tmp);
    const refDau = await scard(`active:${refDate}`);
    await up(['EXPIRE', tmp, 300]);
    return refDau > 0 ? Math.round((inter / refDau) * 1000) / 10 : 0;
  } catch { return 0; }
}

export default async function handler(req: Request): Promise<Response> {
  // 認証 (Vercel Cron + 任意の手動実行)
  const cronSecret = (typeof process !== 'undefined' && process.env?.CRON_SECRET) || '';
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  }
  if (!OK) return json({ ok: false, error: 'UPSTASH_NOT_CONFIGURED' }, 503);

  const url = new URL(req.url);
  // 「対象日」は ?date=, 既定は 前日 (本日 はまだ DAU 集計中 のため)
  const targetDate = url.searchParams.get('date') || dateOffsetDays(1);

  try {
    const dau = await scard(`active:${targetDate}`);
    // WAU = 直近 7 日 unique
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(targetDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - i);
      return `active:${d.toISOString().slice(0, 10)}`;
    });
    const wau = await sunionCount(`tmp:wau:${targetDate}`, last7);
    // MAU = 直近 30 日 unique
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(targetDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - i);
      return `active:${d.toISOString().slice(0, 10)}`;
    });
    const mau = await sunionCount(`tmp:mau:${targetDate}`, last30);
    // 7 日 リテンション = 7 日前 active と 今日 active の 重なり率
    const ref7 = (() => {
      const d = new Date(targetDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 7);
      return d.toISOString().slice(0, 10);
    })();
    const ret7dPct = await ret7dRate(targetDate, ref7);
    // 新規端末 = 今日 active と 過去 30 日 active (今日除く) の 差分 サイズ
    const prev30Sources = Array.from({ length: 29 }, (_, i) => {
      const d = new Date(targetDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - (i + 1));
      return `active:${d.toISOString().slice(0, 10)}`;
    });
    let newDevices = 0;
    try {
      // SUNIONSTORE で 過去 30 日 unique → SDIFFSTORE で 今日との差分
      const allPast = `tmp:past30:${targetDate}`;
      const todaySet = `active:${targetDate}`;
      const diffTmp = `tmp:newdev:${targetDate}`;
      await up(['SUNIONSTORE', allPast, prev30Sources.length, ...prev30Sources]);
      await up(['EXPIRE', allPast, 300]);
      await up(['SDIFFSTORE', diffTmp, 2, todaySet, allPast]);
      await up(['EXPIRE', diffTmp, 300]);
      newDevices = await scard(diffTmp);
    } catch { /* */ }

    // スナップショット保存
    const snap = {
      date: targetDate,
      dau, wau, mau, ret7dPct, newDevices,
      ts: new Date().toISOString(),
    };
    try {
      const hsetArgs: (string | number)[] = ['HSET', `retention:snap:${targetDate}`];
      for (const [k, v] of Object.entries(snap)) hsetArgs.push(k, String(v));
      await up(hsetArgs);
      await up(['EXPIRE', `retention:snap:${targetDate}`, 60 * 86400]); // 60 日 TTL
    } catch (e) {
      console.error('[retention-snapshot] HSET 失敗', (e as Error).message);
    }

    return json({ ok: true, snap });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}
