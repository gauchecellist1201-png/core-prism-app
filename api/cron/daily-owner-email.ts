// ============================================================
// /api/cron/daily-owner-email — 毎朝オーナーに日次 KPI メールを送信
//
// オーナー指示 (2026-06-03 自律): W. CORE 朝のメール
//
// 内容:
//   - 昨日の Stripe 売上 + 今月累計
//   - 新規 Subscription / Customer
//   - 重要アラート (Subscription past_due / canceled など)
//   - 翌日の主要タスク (placeholder)
//
// Vercel Cron 設定 (vercel.json):
//   "crons": [{ "path": "/api/cron/daily-owner-email", "schedule": "30 21 * * *" }]
//   ※ UTC 21:30 = JST 朝 6:30
//
// 必要な env (Vercel Production):
//   STRIPE_SECRET_KEY  = sk_live_xxx
//   RESEND_API_KEY     = re_xxx
//   OWNER_EMAIL        = naoki.ide@core-prism-app.vercel.app など (オーナーの受信先)
//   CRON_SECRET (任意) = Authorization: Bearer 検証
// ============================================================
import Stripe from 'stripe';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // 認証
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL || 'gauche.cellist1201@gmail.com';
  if (!stripeKey || !resendKey) {
    return jsonRes(503, { ok: false, error: 'STRIPE_SECRET_KEY / RESEND_API_KEY 未設定' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 3600_000);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yJst = new Date(yesterday.getTime() + 9 * 3600_000);

  // 売上集計
  let yesterdayRevenue = 0;
  let yesterdayCount = 0;
  let monthRevenue = 0;
  let monthCount = 0;
  let newSubscriptions = 0;
  let alertSubscriptions: Array<{ customer: string; status: string }> = [];

  try {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    let starting_after: string | undefined = undefined;
    while (true) {
      const page: Stripe.Response<Stripe.ApiList<Stripe.Charge>> = await stripe.charges.list({
        created: {
          gte: Math.floor(monthStart.getTime() / 1000),
          lte: Math.floor(now.getTime() / 1000),
        },
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });
      for (const c of page.data) {
        if (c.status !== 'succeeded' || c.currency !== 'jpy') continue;
        monthRevenue += c.amount;
        monthCount += 1;
        // 昨日分
        const cTime = c.created * 1000;
        if (cTime >= startOfDayUtc(yesterday).getTime() && cTime <= endOfDayUtc(yesterday).getTime()) {
          yesterdayRevenue += c.amount;
          yesterdayCount += 1;
        }
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1].id;
    }

    // 新規 Subscription (昨日)
    const subPage = await stripe.subscriptions.list({
      created: {
        gte: Math.floor(startOfDayUtc(yesterday).getTime() / 1000),
        lte: Math.floor(endOfDayUtc(yesterday).getTime() / 1000),
      },
      limit: 100,
    });
    newSubscriptions = subPage.data.length;

    // アラート: past_due / unpaid / canceled (直近 24h)
    const alertPage = await stripe.subscriptions.list({
      status: 'past_due',
      limit: 20,
    });
    alertSubscriptions = alertPage.data.map(s => ({
      customer: typeof s.customer === 'string' ? s.customer : s.customer.id,
      status: s.status,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendResendEmail(resendKey, ownerEmail, `⚠ CORE 朝のメール — Stripe エラー`, `Stripe API エラー: ${msg}`);
    return jsonRes(500, { ok: false, error: msg });
  }

  const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');
  const dateStr = `${jstNow.getFullYear()}/${jstNow.getMonth() + 1}/${jstNow.getDate()}`;
  const yDateStr = `${yJst.getMonth() + 1}/${yJst.getDate()}`;

  // II (2026-06-03): オンボ funnel 取得 (Upstash 経由)
  const funnelYesterday = await loadOnboardFunnel(yJst);

  // RR (2026-06-03): リテンション (DAU + 7 日再訪)
  const retentionYesterday = await loadRetention(yJst);

  // UU (2026-06-03): エラー集計 (Upstash 経由)
  const errorsYesterday = await loadErrors(yJst);

  const html = renderHtml({
    dateStr,
    yDateStr,
    yesterdayRevenue: yen(yesterdayRevenue),
    yesterdayCount,
    monthRevenue: yen(monthRevenue),
    monthCount,
    newSubscriptions,
    alertCount: alertSubscriptions.length,
    alerts: alertSubscriptions,
    funnelYesterday,
    retentionYesterday,
    errorsYesterday,
  });

  await sendResendEmail(
    resendKey, ownerEmail,
    `🌅 CORE 朝のサマリ (${dateStr}) — 昨日 ${yen(yesterdayRevenue)} / ${yesterdayCount}件`,
    html,
  );

  return jsonRes(200, {
    ok: true,
    yesterday: { revenueJpy: yesterdayRevenue, count: yesterdayCount },
    month: { revenueJpy: monthRevenue, count: monthCount },
    newSubscriptions,
    alertCount: alertSubscriptions.length,
  });
}

type OnboardFunnel = {
  welcome: number;
  name: number;
  industry: number;
  apikey: number;
  model: number;
  completed: number;
  dropRate: number;
  available: boolean;
};

const UP_URL_OB = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK_OB = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';

type RetentionStat = {
  dauYesterday: number;
  dauLastWeek: number;
  ret7dPct: number;
  available: boolean;
};

async function loadRetention(yJst: Date): Promise<RetentionStat> {
  const empty: RetentionStat = { dauYesterday: 0, dauLastWeek: 0, ret7dPct: 0, available: false };
  if (!UP_URL_OB || !UP_TOK_OB) return empty;
  const yStr = `${yJst.getFullYear()}-${String(yJst.getMonth() + 1).padStart(2, '0')}-${String(yJst.getDate()).padStart(2, '0')}`;
  const lastWeek = new Date(yJst);
  lastWeek.setDate(yJst.getDate() - 7);
  const wStr = `${lastWeek.getFullYear()}-${String(lastWeek.getMonth() + 1).padStart(2, '0')}-${String(lastWeek.getDate()).padStart(2, '0')}`;
  try {
    const dauRes = await fetch(UP_URL_OB, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UP_TOK_OB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SCARD', `active:${yStr}`]),
    });
    const dauYesterday = Number(((await dauRes.json()) as { result?: number }).result || 0);

    const refRes = await fetch(UP_URL_OB, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UP_TOK_OB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SCARD', `active:${wStr}`]),
    });
    const dauLastWeek = Number(((await refRes.json()) as { result?: number }).result || 0);

    // 1 週前にいたうち、昨日も来てくれた人数
    let inter = 0;
    if (dauLastWeek > 0) {
      const tmp = `tmp:ret:${yStr}:${wStr}`;
      const iRes = await fetch(UP_URL_OB, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${UP_TOK_OB}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['SINTERSTORE', tmp, 2, `active:${wStr}`, `active:${yStr}`]),
      });
      inter = Number(((await iRes.json()) as { result?: number }).result || 0);
      // 後始末
      fetch(UP_URL_OB, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${UP_TOK_OB}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['DEL', tmp]),
      }).catch(() => { /* */ });
    }
    return {
      dauYesterday,
      dauLastWeek,
      ret7dPct: dauLastWeek > 0 ? Math.round((inter / dauLastWeek) * 1000) / 10 : 0,
      available: true,
    };
  } catch { return empty; }
}

type ErrorReport = {
  totalCount: number;
  uniqueFingerprints: number;
  top: Array<{ fingerprint: string; count: number; sample: string }>;
  available: boolean;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}

async function loadErrors(yJst: Date): Promise<ErrorReport> {
  const empty: ErrorReport = { totalCount: 0, uniqueFingerprints: 0, top: [], available: false };
  if (!UP_URL_OB || !UP_TOK_OB) return empty;
  const yStr = `${yJst.getFullYear()}-${String(yJst.getMonth() + 1).padStart(2, '0')}-${String(yJst.getDate()).padStart(2, '0')}`;
  try {
    const countRes = await fetch(UP_URL_OB, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UP_TOK_OB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['HGETALL', `errlog:${yStr}:count`]),
    });
    const carr: string[] = ((await countRes.json()) as { result?: string[] }).result || [];
    const counts: Array<[string, number]> = [];
    let total = 0;
    for (let i = 0; i < carr.length; i += 2) {
      const v = Number(carr[i + 1]) || 0;
      counts.push([carr[i], v]);
      total += v;
    }
    if (counts.length === 0) return { ...empty, available: true };

    // top 3 取得
    counts.sort((a, b) => b[1] - a[1]);
    const topFingerprints = counts.slice(0, 3);

    // サンプルを HGET でまとめて取得
    const top: Array<{ fingerprint: string; count: number; sample: string }> = [];
    for (const [fp, c] of topFingerprints) {
      try {
        const s = await fetch(UP_URL_OB, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${UP_TOK_OB}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(['HGET', `errlog:${yStr}:sample`, fp]),
        });
        const sj = ((await s.json()) as { result?: string }).result || '';
        top.push({ fingerprint: fp, count: c, sample: sj });
      } catch {
        top.push({ fingerprint: fp, count: c, sample: '' });
      }
    }
    return { totalCount: total, uniqueFingerprints: counts.length, top, available: true };
  } catch {
    return empty;
  }
}

async function loadOnboardFunnel(yJst: Date): Promise<OnboardFunnel> {
  const empty: OnboardFunnel = {
    welcome: 0, name: 0, industry: 0, apikey: 0, model: 0, completed: 0,
    dropRate: 0, available: false,
  };
  if (!UP_URL_OB || !UP_TOK_OB) return empty;
  const dateStr = `${yJst.getFullYear()}-${String(yJst.getMonth() + 1).padStart(2, '0')}-${String(yJst.getDate()).padStart(2, '0')}`;
  try {
    const res = await fetch(UP_URL_OB, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UP_TOK_OB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['HGETALL', `onboard:funnel:${dateStr}`]),
    });
    if (!res.ok) return empty;
    const r = await res.json() as { result?: string[] };
    const arr = r.result || [];
    const out: Record<string, number> = {};
    for (let i = 0; i < arr.length; i += 2) out[arr[i]] = Number(arr[i + 1]) || 0;
    const w = out.welcome || 0;
    const c = out.completed || 0;
    return {
      welcome: w,
      name: out.name || 0,
      industry: out.industry || 0,
      apikey: out.apikey || 0,
      model: out.model || 0,
      completed: c,
      dropRate: w > 0 ? Math.round((1 - c / w) * 1000) / 10 : 0,
      available: true,
    };
  } catch { return empty; }
}

function renderHtml(data: {
  dateStr: string;
  yDateStr: string;
  yesterdayRevenue: string;
  yesterdayCount: number;
  monthRevenue: string;
  monthCount: number;
  newSubscriptions: number;
  alertCount: number;
  alerts: Array<{ customer: string; status: string }>;
  funnelYesterday: OnboardFunnel;
  retentionYesterday: RetentionStat;
  errorsYesterday: ErrorReport;
}): string {
  const alertBlock = data.alertCount === 0
    ? `<p style="font-size:13px;color:#666;margin:0">✅ 重要なアラートはありません</p>`
    : `<p style="font-size:13px;color:#DC2626;font-weight:700;margin:0 0 8px">⚠ ${data.alertCount} 件の Subscription にアラート</p>
       <ul style="margin:0;padding-left:20px;font-size:12px;color:#666;line-height:1.7">
         ${data.alerts.slice(0, 5).map(a => `<li>${a.customer} — ${a.status}</li>`).join('')}
       </ul>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#FBBF24,#E84B97);padding:32px 40px;color:#fff">
      <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-.3px">🌅 CORE 朝のサマリ</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:.9">${data.dateStr}</p>
    </div>
    <div style="padding:24px 40px;color:#1F1A2E">
      <h2 style="margin:0 0 16px;font-size:16px;font-weight:800;color:#1F1A2E">📅 昨日 (${data.yDateStr})</h2>
      <div style="background:#FAF7F0;padding:16px 18px;border-radius:10px;margin-bottom:24px">
        <div style="font-size:11px;color:#666;letter-spacing:.1em;font-weight:700;margin-bottom:4px">REVENUE</div>
        <div style="font-size:26px;font-weight:900;color:#0F2540">${data.yesterdayRevenue}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">${data.yesterdayCount} 件</div>
      </div>

      <h2 style="margin:0 0 16px;font-size:16px;font-weight:800">📈 今月累計</h2>
      <div style="background:#F0F4FA;padding:16px 18px;border-radius:10px;margin-bottom:24px">
        <div style="font-size:11px;color:#666;letter-spacing:.1em;font-weight:700;margin-bottom:4px">REVENUE</div>
        <div style="font-size:26px;font-weight:900;color:#0F2540">${data.monthRevenue}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">${data.monthCount} 件</div>
      </div>

      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800">🎁 昨日の新規</h2>
      <p style="font-size:14px;color:#1F1A2E;margin:0 0 24px">
        <strong style="color:#E84B97;font-size:18px">${data.newSubscriptions} 件</strong> の新規 Subscription
      </p>

      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800">👥 昨日のアクティブ</h2>
      ${(() => {
        const r = data.retentionYesterday;
        if (!r.available) {
          return `<p style="font-size:12px;color:#999;margin:0 0 24px;line-height:1.7">
            UPSTASH_REDIS_REST_URL/TOKEN を Vercel env に追加すると DAU + 7 日再訪率が表示されます。
          </p>`;
        }
        const color = r.ret7dPct >= 40 ? '#16A34A' : r.ret7dPct >= 20 ? '#D97706' : '#DC2626';
        return `<div style="background:#F5F3FF;padding:14px 18px;border-radius:10px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div>
              <div style="font-size:11px;color:#666;letter-spacing:.08em;font-weight:700">DAU</div>
              <div style="font-size:22px;font-weight:900;color:#0F2540">${r.dauYesterday} 人</div>
              <div style="font-size:11px;color:#666;margin-top:2px">1 週前: ${r.dauLastWeek} 人</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:#666;letter-spacing:.08em;font-weight:700">7 日 リテンション</div>
              <div style="font-size:22px;font-weight:900;color:${color}">${r.ret7dPct}%</div>
              <div style="font-size:11px;color:#666;margin-top:2px">1 週前ユーザーの再訪率</div>
            </div>
          </div>
        </div>`;
      })()}

      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800">👋 昨日のオンボーディング</h2>
      ${(() => {
        const f = data.funnelYesterday;
        if (!f.available) {
          return `<p style="font-size:12px;color:#999;margin:0 0 24px;line-height:1.7">
            集計には UPSTASH_REDIS_REST_URL/TOKEN を Vercel env に追加してください (Upstash 無料枠 OK)。
          </p>`;
        }
        if (f.welcome === 0) {
          return `<p style="font-size:13px;color:#666;margin:0 0 24px">— 昨日は新規アクセスなし</p>`;
        }
        return `<div style="background:#FFF7ED;padding:14px 18px;border-radius:10px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <div style="font-size:11px;color:#666;letter-spacing:.08em;font-weight:700">FUNNEL</div>
            <div style="font-size:11px;color:${f.dropRate >= 70 ? '#DC2626' : f.dropRate >= 40 ? '#D97706' : '#16A34A'};font-weight:800">離脱率 ${f.dropRate}%</div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;color:#1F1A2E">
            <tr><td style="padding:4px 0;color:#666">入口</td><td style="text-align:right;font-weight:700">${f.welcome}</td></tr>
            <tr><td style="padding:4px 0;color:#666">→ 名前</td><td style="text-align:right;font-weight:700">${f.name}</td></tr>
            <tr><td style="padding:4px 0;color:#666">→ 業種</td><td style="text-align:right;font-weight:700">${f.industry}</td></tr>
            <tr><td style="padding:4px 0;color:#666">→ モデル</td><td style="text-align:right;font-weight:700">${f.model}</td></tr>
            <tr><td style="padding:4px 0;color:#16A34A;font-weight:700">→ 完了</td><td style="text-align:right;font-weight:800;color:#16A34A">${f.completed}</td></tr>
          </table>
        </div>`;
      })()}

      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800">🐛 昨日のフロントエラー</h2>
      ${(() => {
        const er = data.errorsYesterday;
        if (!er.available) {
          return `<p style="font-size:12px;color:#999;margin:0 0 24px;line-height:1.7">
            UPSTASH_REDIS_REST_URL/TOKEN を Vercel env に追加するとエラー集計が表示されます。
          </p>`;
        }
        if (er.totalCount === 0) {
          return `<p style="font-size:13px;color:#16A34A;margin:0 0 24px;font-weight:700">✅ 昨日はエラー 0 件</p>`;
        }
        const sevColor = er.totalCount >= 50 ? '#DC2626' : er.totalCount >= 10 ? '#D97706' : '#16A34A';
        return `<div style="background:#FEF2F2;padding:14px 18px;border-radius:10px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <div style="font-size:11px;color:#666;letter-spacing:.08em;font-weight:700">FRONTEND ERRORS</div>
            <div style="font-size:13px;font-weight:800;color:${sevColor}">${er.totalCount} 件 / ${er.uniqueFingerprints} 種</div>
          </div>
          ${er.top.map((t, i) => {
            let sampleObj: { type?: string; message?: string; url?: string; stack?: string } = {};
            try { sampleObj = JSON.parse(t.sample) as { type?: string; message?: string; url?: string; stack?: string }; } catch { /* */ }
            const headLine = `[${sampleObj.type || '?'}] ${sampleObj.message || t.fingerprint}`.slice(0, 140);
            const stackLine = (sampleObj.stack || '').split('\n')[0]?.slice(0, 200) || '';
            return `<div style="margin-top:${i === 0 ? '4px' : '10px'};padding-top:${i === 0 ? '0' : '10px'};border-top:${i === 0 ? '0' : '1px solid #fff'}">
              <div style="font-size:12px;font-weight:700;color:#1F1A2E;line-height:1.5">
                <span style="display:inline-block;min-width:28px;background:${sevColor};color:#fff;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:800;text-align:center;margin-right:6px">×${t.count}</span>
                ${escapeHtml(headLine)}
              </div>
              ${stackLine ? `<div style="font-size:10.5px;color:#6B7280;font-family:Menlo,monospace;margin-top:3px;margin-left:34px;line-height:1.4">${escapeHtml(stackLine)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      })()}

      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800">⚠ 重要アラート</h2>
      ${alertBlock}

      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee">
        <a href="https://dashboard.stripe.com" style="display:inline-block;background:linear-gradient(135deg,#FBBF24,#E84B97);color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:13px">
          Stripe Dashboard を開く →
        </a>
      </div>

      <p style="font-size:11px;color:#999;margin:24px 0 0;line-height:1.7">
        このメールは CORE 朝のサマリ Cron から自動送信されています。<br />
        オーナー設定: 毎朝 JST 6:30 / 受信先: ${process.env.OWNER_EMAIL || 'OWNER_EMAIL'}
      </p>
    </div>
  </div>
</body></html>`;
}

async function sendResendEmail(apiKey: string, to: string, subject: string, html: string): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CORE 朝のサマリ <noreply@core-prism-app.vercel.app>',
        to,
        subject,
        html,
      }),
    });
  } catch { /* silent */ }
}

function startOfDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function endOfDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}
function jsonRes(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
