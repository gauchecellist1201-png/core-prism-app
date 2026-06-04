// ============================================================
// /api/cron/anomaly-detect — 数字が変だよ AI 自動アラート (Edge)
//
// オーナー指示 (2026-06-04 第 28 波 UUUU):
//   主要 KPI (オンボ funnel / CTA / AI / エラー) の前日 → 当日 を比較し、
//   50% 以上の急増 or 急減 を検知したら Slack に通知。
//
// Vercel Cron 設定 (vercel.json):
//   "crons": [{ "path": "/api/cron/anomaly-detect", "schedule": "0 18 * * *" }]
//   ※ UTC 18:00 = JST 翌 3:00 (前日 0:00-24:00 JST 集計が確定するタイミング)
//
// 必要な env (Vercel Production):
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  — KPI ソース
//   SLACK_WEBHOOK_URL                                   — 通知先
//   CRON_SECRET (任意)                                  — Bearer 検証
//
// 比較対象 ハッシュ キー:
//   - onboard:funnel:<date>   (step ごと)
//   - cta:ab:<date>           (variant:event[:location] ごと)
//   - ai:stats:<date>         (model_route ごと)
//   - err:count               (date 別なし — 累積。前日比は HGETALL 差で代用)
//
// 判定:
//   - 前日 0 → 当日 N: 急増 (急にユーザーが触ったか障害かは要人手判断)
//   - 前日 N → 当日 0: 急減 (CDN/Edge ダウン疑い)
//   - 50% 以上の上下動: 注意
// ============================================================

export const config = { runtime: 'edge' };

interface KpiDelta {
  category: string;
  field: string;
  prev: number;
  curr: number;
  changePct: number;          // null = prev 0 (急増判定)
  level: 'critical' | 'warn' | 'ok';
  reason: string;
  // QQQQQ (2026-06-04): 先週 平均比較 (前日比 とは別軸)
  weekAvg?: number;           // 直近 7 日 平均 (curr 含まず)
  weekChangePct?: number;
  weekLevel?: 'critical' | 'warn' | 'ok';
  weekReason?: string;
}

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const SLACK = (typeof process !== 'undefined' && process.env?.SLACK_WEBHOOK_URL) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

async function upstash(cmd: (string | number)[]): Promise<any> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Upstash の HGETALL レスポンスを Record<string,number> に */
function parseHash(res: any): Record<string, number> {
  const out: Record<string, number> = {};
  const arr = res?.result;
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const k = String(arr[i]);
    const v = Number(arr[i + 1]);
    if (Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function judge(prev: number, curr: number): { changePct: number; level: 'critical' | 'warn' | 'ok'; reason: string } {
  // 「変化率」 — prev=0 の時は curr の絶対値で判定
  if (prev === 0 && curr === 0) return { changePct: 0, level: 'ok', reason: '両日 0 — 異常なし' };
  if (prev === 0) {
    // 突然出現 — 量で warn/critical
    if (curr >= 50) return { changePct: 9999, level: 'critical', reason: `前日 0 → 当日 ${curr} (新規発生)` };
    if (curr >= 10) return { changePct: 9999, level: 'warn', reason: `前日 0 → 当日 ${curr} (新規発生)` };
    return { changePct: 9999, level: 'ok', reason: `前日 0 → 当日 ${curr} (少量で許容)` };
  }
  if (curr === 0) {
    if (prev >= 10) return { changePct: -100, level: 'critical', reason: `前日 ${prev} → 当日 0 (消滅)` };
    return { changePct: -100, level: 'warn', reason: `前日 ${prev} → 当日 0 (少量消滅)` };
  }
  const pct = ((curr - prev) / prev) * 100;
  const absPct = Math.abs(pct);
  if (absPct >= 100) return { changePct: pct, level: 'critical', reason: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% (倍以上の変化)` };
  if (absPct >= 50) return { changePct: pct, level: 'warn', reason: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% (50%以上)` };
  return { changePct: pct, level: 'ok', reason: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% (許容)` };
}

async function diffDailyHash(category: string, keyTmpl: (date: string) => string, prevDate: string, currDate: string): Promise<KpiDelta[]> {
  const out: KpiDelta[] = [];
  try {
    // 前日 / 当日 + QQQQQ: 当日の前 7 日 (week avg 用)
    const week7Dates: string[] = [];
    {
      const base = new Date(currDate + 'T00:00:00Z');
      for (let i = 1; i <= 7; i++) {
        const d = new Date(base.getTime());
        d.setUTCDate(d.getUTCDate() - i);
        week7Dates.push(d.toISOString().slice(0, 10));
      }
    }
    const [pRes, cRes, ...wRess] = await Promise.all([
      upstash(['HGETALL', keyTmpl(prevDate)]),
      upstash(['HGETALL', keyTmpl(currDate)]),
      ...week7Dates.map((d) => upstash(['HGETALL', keyTmpl(d)])),
    ]);
    const prev = parseHash(pRes);
    const curr = parseHash(cRes);
    const weeks = wRess.map((r) => parseHash(r));
    const fields = new Set([...Object.keys(prev), ...Object.keys(curr)]);
    // 7 日 のいずれかに field が出ていれば 平均集計の 対象に追加
    for (const wh of weeks) Object.keys(wh).forEach((k) => fields.add(k));
    for (const f of fields) {
      const p = prev[f] || 0;
      const c = curr[f] || 0;
      const j = judge(p, c);
      // 7 日 平均
      let sum = 0, count = 0;
      for (const wh of weeks) {
        const v = wh[f] || 0;
        sum += v; count += 1;
      }
      const weekAvg = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
      const wj = judge(weekAvg, c);
      out.push({
        category, field: f,
        prev: p, curr: c,
        changePct: j.changePct,
        level: j.level,
        reason: j.reason,
        weekAvg,
        weekChangePct: wj.changePct,
        weekLevel: wj.level,
        weekReason: `先週平均比 ${wj.reason}`,
      });
    }
  } catch {
    /* category ごと欠損は無視 */
  }
  return out;
}

async function notifySlackRich(text: string, blocks: unknown[]): Promise<void> {
  if (!SLACK) return;
  await fetch(SLACK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, blocks }),
  }).catch(() => { /* */ });
}

export default async function handler(req: Request): Promise<Response> {
  // 認証
  const cronSecret = (typeof process !== 'undefined' && process.env?.CRON_SECRET) || '';
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  }
  if (!UPSTASH_OK) {
    return jsonRes(503, { ok: false, error: 'UPSTASH_NOT_CONFIGURED' });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const prevDate = url.searchParams.get('prev') || dateOffsetDays(2);
  const currDate = url.searchParams.get('curr') || dateOffsetDays(1);

  // 4 カテゴリ 比較
  const deltas: KpiDelta[] = [];
  deltas.push(...await diffDailyHash('オンボ funnel', (d) => `onboard:funnel:${d}`, prevDate, currDate));
  deltas.push(...await diffDailyHash('CTA A/B',      (d) => `cta:ab:${d}`,         prevDate, currDate));
  deltas.push(...await diffDailyHash('AI 利用',       (d) => `ai:stats:${d}`,       prevDate, currDate));

  // エラー: 日付なし キー — 「累計」 を直近 と 2 日前 のスナップショットでとっておきたいが
  // 現状 err:count は date 別なし → 差分 が「累計の伸び」 = 当日エラー件数 になる。
  // → snapshot を `anomaly:err:<date>` に保存 → 翌日比較 する 自己 ジャーナル方式。
  try {
    const errSnap = await upstash(['HGETALL', 'err:count']);
    const flat = parseHash(errSnap);
    // 現在のスナップを保存
    const snapKey = `anomaly:err:${currDate}`;
    const pairs: (string | number)[] = ['HSET', snapKey];
    for (const [k, v] of Object.entries(flat)) { pairs.push(k, v); }
    if (pairs.length > 2) {
      await upstash(pairs);
      await upstash(['EXPIRE', snapKey, 30 * 86400]);
    }
    // 前日スナップ
    const prevSnap = await upstash(['HGETALL', `anomaly:err:${prevDate}`]);
    const prev = parseHash(prevSnap);
    const fields = new Set([...Object.keys(prev), ...Object.keys(flat)]);
    for (const f of fields) {
      const p = prev[f] || 0;
      const c = flat[f] || 0;
      const j = judge(p, c);
      deltas.push({ category: 'エラー', field: f, prev: p, curr: c, changePct: j.changePct, level: j.level, reason: j.reason });
    }
  } catch { /* */ }

  // フィルタ: 前日比 / 先週平均比 のいずれかが warn 以上
  const alerts = deltas.filter((d) => d.level !== 'ok' || (d.weekLevel && d.weekLevel !== 'ok'));
  const crit = alerts.filter((d) => d.level === 'critical' || d.weekLevel === 'critical');
  const warn = alerts.filter((d) => !(d.level === 'critical' || d.weekLevel === 'critical') && (d.level === 'warn' || d.weekLevel === 'warn'));
  // QQQQQ: 先週平均 比較 のみ warn (前日比は ok) のカテゴリを 別ラベル
  const weekOnly = alerts.filter((d) => d.level === 'ok' && d.weekLevel && d.weekLevel !== 'ok');

  // dryRun の時は Slack 送らずそのまま返す
  if (!dryRun && SLACK && alerts.length > 0) {
    const head = crit.length ? '🚨' : '⚠';
    const text = `${head} CORE 数字異常 — ${currDate}: critical ${crit.length} / warn ${warn.length} (先週平均比のみ ${weekOnly.length})`;
    const blocks: unknown[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${head} 数字が変だよ — ${currDate}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*🚨 critical*\n${crit.length} 件 (前日 or 先週 で倍以上)` },
          { type: 'mrkdwn', text: `*⚠ warn*\n${warn.length} 件 (±50% 以上)` },
          { type: 'mrkdwn', text: `*📊 先週平均比 のみ*\n${weekOnly.length} 件` },
          { type: 'mrkdwn', text: `*基準*\n前日 ${prevDate} / 先週平均 = 直近 7 日` },
        ],
      },
      { type: 'divider' },
    ];
    // critical を 5 件まで詳細、warn 5、weekOnly 3
    const detail = [
      ...crit.slice(0, 5).map((d) => ({ ...d, _kind: 'critical' as const })),
      ...warn.slice(0, 5).map((d) => ({ ...d, _kind: 'warn' as const })),
      ...weekOnly.slice(0, 3).map((d) => ({ ...d, _kind: 'weekOnly' as const })),
    ];
    for (const d of detail) {
      const icon = d._kind === 'critical' ? '🚨' : d._kind === 'weekOnly' ? '📊' : '⚠';
      const dayLine = `_前日比_ ${prevDate} → ${currDate}: ${d.prev} → ${d.curr} *(${d.reason})*`;
      const weekLine = d.weekAvg !== undefined
        ? `_先週平均比_ 平均 ${d.weekAvg} → ${currDate}: ${d.curr} *(${d.weekReason})*`
        : '';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${icon} *${d.category}* — \`${d.field}\`\n${dayLine}\n${weekLine}`,
        },
      });
    }
    blocks.push(
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '_前日比 ±50% で warn / ±100% or 突発/消滅 で critical · 先週平均比も同じ閾値で並行判定 (QQQQQ)_' },
        ],
      },
    );
    await notifySlackRich(text, blocks);
  }

  return jsonRes(200, {
    ok: true,
    prevDate,
    currDate,
    counts: { critical: crit.length, warn: warn.length, weekOnly: weekOnly.length, total: deltas.length },
    dryRun,
    sample: alerts.slice(0, 20),
  });
}
