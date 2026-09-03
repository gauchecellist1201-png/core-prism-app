// ============================================================
// /api/roai/lead — CORE ROAI SCORE からのリード受信
//
// POST { kind: 'report' | 'consult', answers, contact: { email, company?, name?, phone?, message? }, source?, website? }
//   ・answers はサーバー側で正規化し、engine を再計算する（クライアントのスコアは信用しない）
//   ・Lead Score（HOT / WARM / NURTURE）はサーバーでだけ算定し、本人には返さない
//   ・Upstash に保存: roai:lead:<id>（JSON・保持 RETENTION_DAYS）＋ roai:leads（一覧 id、最新 2000 件）
//   ・オーナーへ Resend（無ければ Gmail SMTP フォールバック）で通知。申込者へ受付メール（Resend のみ）
//   ・Rate limit: 同一 IP 1 時間 10 回。honeypot（website）に値があれば黙って 200
//
// Integration Layer: 将来の CRM / Slack / Nexus 連携は notify() の中に足す（この handler の外形は変えない）。
// ============================================================
import { computeRoai, sanitizeAnswers, formatRangeYen, formatYen, formatHours, type RoaiResult } from '../../src/corporate/roai/engine';
import { INDUSTRY_LABEL } from '../../src/corporate/roai/schema';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);
/** 個人情報の保持日数（診断データと連絡先を同じ寿命で消す） */
export const RETENTION_DAYS = 365;
const RATE_LIMIT_PER_HOUR = 10;

const ALLOWED_ORIGINS = new Set([
  'https://core-prism-app.vercel.app', 'https://www.core-ai.jp', 'https://core-ai.jp',
  'http://localhost:5173', 'http://localhost:4173',
]);

async function up(cmd: (string | number)[]): Promise<{ result?: unknown }> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export interface LeadContact { email: string; company: string; name: string; phone: string; message: string }
export interface LeadRecord {
  id: string; kind: 'report' | 'consult'; ts: number; source: string;
  contact: LeadContact; answers: Record<string, string>;
  result: { score: number; readiness: number; tier: RoaiResult['lead']['tier']; leadScore: number; factors: string[]; total: { low: number; mid: number; high: number }; top: string; mode: string; version: string };
}

/** 入力の正規化。例外を投げず、問題は reason で返す。 */
export function validateLead(raw: unknown): { ok: true; kind: 'report' | 'consult'; contact: LeadContact; answers: Record<string, string>; source: string; honeypot: boolean } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'invalid_body' };
  const b = raw as Record<string, unknown>;
  const kind = b.kind === 'consult' ? 'consult' : b.kind === 'report' ? 'report' : null;
  if (!kind) return { ok: false, reason: 'invalid_kind' };
  const c = (b.contact && typeof b.contact === 'object' ? b.contact : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const contact: LeadContact = {
    email: str(c.email, 200).toLowerCase(), company: str(c.company, 120), name: str(c.name, 80), phone: str(c.phone, 40), message: str(c.message, 2000),
  };
  if (!EMAIL_RE.test(contact.email)) return { ok: false, reason: 'invalid_email' };
  const answers = sanitizeAnswers(b.answers);
  if (Object.keys(answers).length < 5) return { ok: false, reason: 'too_few_answers' };
  const honeypot = str(b.website, 10).length > 0;
  return { ok: true, kind, contact, answers, source: str(b.source, 40).replace(/[^a-zA-Z0-9._:-]/g, '_'), honeypot };
}

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
async function ipHash(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`roai|${ip}`));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function rateLimited(req: Request): Promise<boolean> {
  if (!UPSTASH_OK) return false;
  try {
    const key = `roai:rl:${await ipHash(clientIp(req))}`;
    const r = await up(['INCR', key]);
    const n = Number(r.result) || 0;
    if (n === 1) await up(['EXPIRE', key, 3600]);
    return n > RATE_LIMIT_PER_HOUR;
  } catch { return false; }
}

async function persist(rec: LeadRecord): Promise<boolean> {
  if (!UPSTASH_OK) return false;
  try {
    await up(['SET', `roai:lead:${rec.id}`, JSON.stringify(rec), 'EX', RETENTION_DAYS * 86400]);
    await up(['LPUSH', 'roai:leads', rec.id]);
    await up(['LTRIM', 'roai:leads', 0, 1999]);
    return true;
  } catch (e) {
    console.error('[roai-lead] persist failed', (e as Error).message);
    return false;
  }
}

async function gmailFallback(req: Request, subject: string, bodyText: string, replyTo?: string): Promise<boolean> {
  try {
    const u = new URL('/api/mail/gmail', req.url);
    const r = await fetch(u.toString(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: 'lead_notify', data: { subject, bodyText, replyTo } }),
    });
    return r.ok;
  } catch { return false; }
}

function ownerText(rec: LeadRecord, r: RoaiResult): string {
  const ind = r.industry ? INDUSTRY_LABEL[r.industry] : '未回答';
  return [
    `種別: ${rec.kind === 'consult' ? 'ROAI戦略相談' : '詳細レポート希望'}`,
    `Lead: ${rec.result.tier}（${rec.result.leadScore}） ${rec.result.factors.join(' / ')}`,
    `会社: ${rec.contact.company || '(未記入)'} / ${rec.contact.name || '(未記入)'} / ${rec.contact.email} / ${rec.contact.phone || '-'}`,
    `業種: ${ind}  従業員: ${r.profile.employees} 人規模  年商: ${formatYen(r.profile.revenue)} 規模`,
    `CORE ROAI SCORE: ${r.score}  Readiness: ${r.readiness}  モード: ${r.recommendation.mode}`,
    `Opportunity Map: ${Object.entries(r.categoryScores).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' / ')}`,
    `年間経済価値: ${formatRangeYen(r.value.total)}  時間: ${formatHours(r.value.hoursSaved.mid)}  投資余力(5x): ${formatYen(r.capacity.indicative)}`,
    `第1優先: ${r.priorities[0].title}（${r.priorities[0].titleJa}）`,
    `出所: ${rec.source || '-'}`,
    '', 'メッセージ:', rec.contact.message || '(なし)',
    '', `id: ${rec.id}`,
  ].join('\n');
}

async function notify(req: Request, rec: LeadRecord, r: RoaiResult): Promise<{ owner: boolean; reply: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.FEEDBACK_TO_EMAIL || process.env.EMAIL_FROM;
  const from = process.env.EMAIL_FROM || 'info@core-ai.jp';
  const subject = `[ROAI ${rec.result.tier}] ${rec.kind === 'consult' ? '相談' : 'レポート'} ${rec.contact.company || rec.contact.email} / SCORE ${r.score} / ${formatRangeYen(r.value.total)}`;
  const text = ownerText(rec, r);
  let owner = false, reply = false;

  if (apiKey && ownerEmail) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: ownerEmail, reply_to: rec.contact.email, subject, text }),
      });
      owner = res.ok;
    } catch { owner = false; }
  }
  if (!owner) owner = await gmailFallback(req, subject, text, rec.contact.email);

  // 申込者への受付メール（Resend が使えるときだけ）
  if (apiKey) {
    const who = rec.contact.name ? `${esc(rec.contact.name)} 様` : `${esc(rec.contact.company || rec.contact.email)} 様`;
    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,'Noto Sans JP',sans-serif;background:#F3F6FB;padding:24px;color:#0B1220">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
<div style="background:#070A10;padding:22px 28px;color:#fff"><div style="font-size:11px;letter-spacing:.3em;color:#7DD3FC">CORE ROAI SCORE</div>
<h2 style="margin:6px 0 0;font-size:18px;font-weight:800">${rec.kind === 'consult' ? 'ROAI 戦略相談を受け付けました' : 'AI Transformation Brief の詳細版を準備します'}</h2></div>
<div style="padding:24px 28px;font-size:14px;line-height:1.8">
<p style="margin:0 0 14px">${who}</p>
<p style="margin:0 0 14px">株式会社CORE です。診断結果を確認のうえ、通常 1〜3 営業日以内にご連絡します。</p>
<table style="width:100%;font-size:13px;border-collapse:collapse">
<tr><td style="color:#64748B;padding:6px 0;width:150px">CORE ROAI SCORE</td><td><strong>${r.score} / 100</strong></td></tr>
<tr><td style="color:#64748B;padding:6px 0">AI Readiness</td><td>${r.readiness} / 100</td></tr>
<tr><td style="color:#64748B;padding:6px 0">年間の潜在経済価値</td><td>${esc(formatRangeYen(r.value.total))}</td></tr>
<tr><td style="color:#64748B;padding:6px 0">第 1 優先</td><td>${esc(r.priorities[0].titleJa)}</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#64748B">数値は入力情報と一定の仮定に基づく概算シミュレーションであり、成果を保証するものではありません。</p>
<p style="font-size:11px;color:#94A3B8;margin:24px 0 0;border-top:1px solid #E2E8F0;padding-top:14px">このメールは自動送信です。ご返信は info@core-ai.jp まで。</p>
</div></div></body></html>`;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: rec.contact.email, subject: `【CORE】${rec.kind === 'consult' ? 'ROAI 戦略相談を受け付けました' : '詳細レポートのご依頼を受け付けました'}`, html }),
      });
      reply = res.ok;
    } catch { reply = false; }
  }
  return { owner, reply };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  // 同一オリジンのフォームだけを受ける（外部からの大量投稿の抑止。Origin 無しの古い UA は通す）
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: 'forbidden_origin' }, 403);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const v = validateLead(raw);
  if (!v.ok) return json({ ok: false, error: v.reason }, 400);
  if (v.honeypot) return json({ ok: true, delivered: true, stored: true, id: 'ok' });
  if (await rateLimited(req)) return json({ ok: false, error: 'rate_limited' }, 429);

  const r = computeRoai(v.answers);
  const id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const rec: LeadRecord = {
    id, kind: v.kind, ts: Date.now(), source: v.source, contact: v.contact, answers: v.answers,
    result: {
      score: r.score, readiness: r.readiness, tier: r.lead.tier, leadScore: r.lead.score, factors: r.lead.factors,
      total: { low: r.value.total.low, mid: r.value.total.mid, high: r.value.total.high },
      top: r.priorities[0].title, mode: r.recommendation.mode, version: r.version,
    },
  };

  // Vercel Functions Logs にも構造化で残す（メール・KV が両方落ちても失わない）。本文の message は載せない
  console.log('[roai-lead]', JSON.stringify({ id, kind: rec.kind, tier: rec.result.tier, score: r.score, total: rec.result.total.mid, company: rec.contact.company, email: rec.contact.email, source: rec.source }));

  const stored = await persist(rec);
  const n = await notify(req, rec, r);
  return json({ ok: true, id, stored, delivered: n.owner, replied: n.reply });
}
