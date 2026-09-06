// ============================================================
// /api/roai/leads — CORE ROAI SCORE のリード一覧（オーナー専用）
// GET ?master_key=…&limit=50   x-master-key ヘッダでも可
// GET ?id=<leadId>             1件だけ、回答を日本語のラベルに直して返す
//
// Sales Intelligence の最初の一段。ここを CRM / Nexus へ流すときは、
// この endpoint を読む側を足す（書き込み側 api/roai/lead.ts は変えない）。
//
// ?id= を足した理由（2026-09-06）:
//   申込 → 台帳（Sales OS）へ流す道はできたが、逆に「台帳の顧客が診断で何と答えたか」を
//   見る道が無かった。台帳へ入るのは要約文だけで、回答そのもの（週に何時間 手入力しているか、
//   予算はあるか、いつ始めたいか）は Upstash に眠ったまま商談に持って行けなかった。
//   質問文・選択肢の正本は src/corporate/roai/schema.ts にしかないので、
//   ラベルに直すのはここ（CORE 側）でやる。読む側に質問文を複製させない。
// ============================================================
import type { LeadRecord } from './lead';
import { logMasterAudit } from '../_lib/masterAudit';
import { ALL_QUESTIONS, CATEGORY_LABEL, QUESTION_BY_ID, findOption } from '../../src/corporate/roai/schema';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);
const MASTER_KEY = (typeof process !== 'undefined' && process.env?.MASTER_KEY) || 'GAUCHE2026';

async function up(cmd: (string | number)[]): Promise<{ result?: unknown }> {
  const res = await fetch(UP_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export interface LabeledAnswer {
  /** 質問 id（schema から消えた過去の質問でも、この id は必ず残す） */
  id: string;
  /** 見出し（会社について / 売上を増やす …）。未知の質問は空文字 */
  group: string;
  /** 質問文。schema に無ければ id をそのまま出す */
  q: string;
  /** 選んだ選択肢の日本語。schema に無ければ保存されている値をそのまま出す */
  a: string;
  /** schema と突き合わせられたか。false は「昔の版の回答」を意味する */
  known: boolean;
}

/**
 * 保存された回答（質問 id → 選択肢 value）を、人が読める形に直す。
 *
 * ・並び順は ALL_QUESTIONS に合わせる（保存時のキー順に依存しない）
 * ・schema から消えた質問・選択肢は捨てずに raw のまま出す。
 *   捨てると「答えたのに空欄」になり、商談前に見る人が誤解する。
 */
export function labelAnswers(answers: Record<string, string> | undefined): LabeledAnswer[] {
  const raw = answers && typeof answers === 'object' ? answers : {};
  const keys = Object.keys(raw);
  const order = new Map(ALL_QUESTIONS.map((q, i) => [q.id, i]));
  keys.sort((a, b) => (order.get(a) ?? 9_999) - (order.get(b) ?? 9_999) || a.localeCompare(b));
  return keys.map(id => {
    const q = QUESTION_BY_ID[id];
    const value = String(raw[id] ?? '');
    if (!q) return { id, group: '', q: id, a: value, known: false };
    const opt = findOption(q, value);
    return { id, group: CATEGORY_LABEL[q.category]?.ja ?? '', q: q.text, a: opt?.label ?? value, known: Boolean(opt) };
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(req.url);
  const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
  // フル PII を返す口なので、他の api/master/* と同じく閲覧を監査ログに残す
  if (key !== MASTER_KEY) {
    await logMasterAudit(req, '/api/roai/leads', 'forbidden');
    return json({ error: 'forbidden' }, 403);
  }
  await logMasterAudit(req, '/api/roai/leads', 'ok');
  if (!UPSTASH_OK) return json({ ok: true, configured: false, leads: [] });

  // 1件だけ（台帳の顧客 → 診断結果を見に来た時）
  const one = (url.searchParams.get('id') || '').trim();
  if (one) {
    if (!/^[A-Za-z0-9._:-]{1,64}$/.test(one)) return json({ ok: false, error: 'invalid_id' }, 400);
    try {
      const raw = (await up(['GET', `roai:lead:${one}`])).result;
      if (typeof raw !== 'string') return json({ ok: true, configured: true, lead: null }, 404);
      const lead = JSON.parse(raw) as LeadRecord;
      const topJa = CATEGORY_LABEL[lead.result?.top as keyof typeof CATEGORY_LABEL]?.ja ?? '';
      return json({ ok: true, configured: true, lead: { ...lead, topJa, labeled: labelAnswers(lead.answers) } });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  }

  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || '50')));
  try {
    const ids = ((await up(['LRANGE', 'roai:leads', 0, limit - 1])).result as string[]) || [];
    const leads: LeadRecord[] = [];
    for (const id of ids) {
      const raw = (await up(['GET', `roai:lead:${id}`])).result;
      if (typeof raw === 'string') { try { leads.push(JSON.parse(raw)); } catch { /* */ } }
    }
    const tiers = { HOT: 0, WARM: 0, NURTURE: 0 } as Record<string, number>;
    for (const l of leads) tiers[l.result.tier] = (tiers[l.result.tier] || 0) + 1;
    return json({ ok: true, configured: true, count: leads.length, tiers, leads });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}
