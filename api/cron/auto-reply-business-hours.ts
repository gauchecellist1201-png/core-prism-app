// ============================================================
// /api/cron/auto-reply-business-hours — 営業時間外 一次返信
//
// オーナー指示 (2026-06-04 第 39 波 CCCCCC):
//   JST 18:00-翌 09:00 に届いた /api/feedback (kind=contact) を
//   翌朝 自動で 「営業時間外で 申し訳ありません」 と 一次返信。
//   重複防止: contact:auto-reply:<id> (TTL 14 日)。
//
// 推奨 cron: "0 0 * * *" (UTC 0:00 = JST 9:00)
//
// 必要 env:
//   UPSTASH_REDIS_REST_URL / TOKEN
//   RESEND_API_KEY
//   CRON_SECRET (任意)
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);
const RESEND_KEY = (typeof process !== 'undefined' && process.env?.RESEND_API_KEY) || '';

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

interface FB {
  brand: string; kind: string; nps?: number; exitReason?: string;
  comment: string; email: string; url: string; ts: number;
}

function escHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

/** JST 18:00 - 09:00 を「営業時間外」と判定 */
function isOffHoursJst(epochMs: number): boolean {
  const jstH = Math.floor(((epochMs / 1000) + 9 * 3600) / 3600) % 24;
  return jstH >= 18 || jstH < 9;
}

function buildAutoReplyHtml(name: string, comment: string): { subject: string; html: string } {
  const safeName = name || 'お客様';
  const subject = `[CORE] お問い合わせ ありがとうございます (営業時間外 自動返信)`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Hiragino Sans','Yu Gothic',sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#6366F1,#A78BFA);padding:24px 28px;color:#fff">
    <h1 style="margin:0;font-size:20px;font-weight:900">お問い合わせ ありがとうございます</h1>
    <p style="margin:6px 0 0;font-size:13px;opacity:.95">${escHtml(safeName)} 様</p>
  </div>
  <div style="padding:24px 28px;color:#1F1A2E;line-height:1.8;font-size:14px">
    <p style="margin:0 0 14px">CORE Prism / Iris をご覧いただき ありがとうございます。</p>
    <p style="margin:0 0 14px">いただいた お問い合わせ は <strong>営業時間外 (JST 18:00 - 09:00)</strong> に届いた ため、本メール を 自動 一次返信 として お送りしています。</p>
    <p style="margin:0 0 14px">担当 (代表 井出) より <strong>本日 9:00 - 18:00 (JST)</strong> の間に 直接 返信いたします。緊急 / 投資判断 に関わる ご相談 は 件名 に 「緊急」 とお書きください — 30 分以内に 折り返します。</p>
    <div style="background:#F5F3FF;padding:14px 16px;border-radius:10px;margin:18px 0">
      <div style="font-size:11px;color:#6366F1;font-weight:800;letter-spacing:.08em;margin-bottom:6px">いただいた お問い合わせ (一部)</div>
      <div style="font-size:13px;color:#1F1A2E;white-space:pre-wrap;line-height:1.7">${escHtml(comment.slice(0, 600))}</div>
    </div>
    <p style="font-size:12px;color:#666;margin:18px 0 0">— 株式会社CORE 代表取締役 井出直毅 (Naoki Ide)<br />
    <a href="https://core-prism-app.vercel.app/" style="color:#6366F1">https://core-prism-app.vercel.app/</a></p>
    <p style="font-size:10px;color:#9CA3AF;margin:18px 0 0;border-top:1px solid #eee;padding-top:12px">
      このメール は 自動送信です。返信は <a href="mailto:gauche.cellist1201@gmail.com">gauche.cellist1201@gmail.com</a> へ。
    </p>
  </div>
</div></body></html>`;
  return { subject, html };
}

function fbId(fb: FB): string {
  // ts + email + 先頭 12 字 で 重複防止 (同一 contact が 2 回処理されないように)
  return `${fb.ts}-${fb.email.slice(0, 24)}`.replace(/[^a-zA-Z0-9@.-]/g, '_');
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = (typeof process !== 'undefined' && process.env?.CRON_SECRET) || '';
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  }
  if (!OK) return json({ ok: false, error: 'upstash_not_configured' }, 503);
  if (!RESEND_KEY) return json({ ok: false, error: 'resend_not_configured' }, 503);

  // ?dryRun=1 で 送信 せず ターゲット 確認
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  // 対象日: 昨日 (UTC) + 今日 (UTC 0-now) の 範囲を 走査
  // JST 18:00-09:00 範囲が UTC で 9:00-24:00 と 翌 0:00-...
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const dates = [y, today];

  // 全 contact を取得 → off-hours 判定 → auto-reply 送信
  const candidates: FB[] = [];
  for (const d of dates) {
    try {
      const r = await up(['LRANGE', `feedback:${d}`, 0, -1]);
      const arr = ((r as { result?: string[] }).result || []) as string[];
      for (const s of arr) {
        try {
          const fb: FB = JSON.parse(s);
          if (fb.kind !== 'contact') continue;
          if (!fb.email || !fb.email.includes('@')) continue;
          if (!isOffHoursJst(fb.ts)) continue;
          candidates.push(fb);
        } catch { /* */ }
      }
    } catch { /* */ }
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const fb of candidates) {
    const id = fbId(fb);
    const guard = `contact:auto-reply:${id}`;
    try {
      const exists = await up(['GET', guard]);
      if ((exists as { result?: string | null }).result) { skipped++; continue; }
    } catch { /* */ }
    if (dryRun) { sent++; continue; }
    const firstName = fb.email.split('@')[0];
    const { subject, html } = buildAutoReplyHtml(firstName, fb.comment);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CORE Prism <noreply@resend.dev>',
          to: [fb.email],
          subject,
          html,
        }),
      });
      if (!res.ok) throw new Error(`resend ${res.status}`);
      await up(['SET', guard, new Date().toISOString(), 'EX', 14 * 86400]);
      sent++;
    } catch (e) {
      console.error('[auto-reply] failed', fb.email, (e as Error).message);
      failed++;
    }
  }

  return json({
    ok: true,
    dryRun,
    candidates: candidates.length,
    sent,
    skipped,
    failed,
    scannedDates: dates,
  });
}
