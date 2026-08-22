// ============================================================
// POST /api/sales/activity — 営業結果を入れる
//
// body: { id, kind, note?, dealYen?, lostReason? }
// 結果を入れた瞬間に「次にやる日」と「次にやること」が必ず入る。
// x-master-key 必須
// ============================================================
import { corsHeaders, errMessage, json, requireMaster } from '../_lib/sales/http';
import { KvNotConfigured } from '../_lib/sales/kv';
import { addActivity, bumpDay, getCompany, newId, nowISO, putCompany, todayISO } from '../_lib/sales/store';
import { applyActivity } from '../_lib/sales/flow';
import type { Activity, ActivityKind } from '../../src/sales/shared/types';

export const config = { runtime: 'edge' };

const KINDS: ActivityKind[] = [
  'call', 'call_no_answer', 'email', 'reply', 'meeting',
  'proposal', 'trial', 'won', 'monthly', 'oem', 'lost', 'note',
];

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  const denied = requireMaster(req, ch);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim().slice(0, 80) : '';
    const kind = String(body.kind || '') as ActivityKind;
    if (!id) return json({ error: 'EMPTY', message: 'id がありません。' }, 400, ch);
    if (!KINDS.includes(kind)) return json({ error: 'BAD_KIND', message: '記録できる種類ではありません。' }, 400, ch);

    const company = await getCompany(id);
    if (!company) return json({ error: 'NOT_FOUND', message: 'その営業先は見つかりませんでした。' }, 404, ch);

    const dealYenRaw = Number(body.dealYen);
    const dealYen = Number.isFinite(dealYenRaw) && dealYenRaw > 0 ? Math.min(Math.round(dealYenRaw), 100_000_000) : undefined;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    const lostReason = typeof body.lostReason === 'string' ? body.lostReason.trim().slice(0, 200) : '';

    const at = nowISO();
    const today = todayISO();
    const { company: updated } = applyActivity({ company, kind, today, nowISO: at, dealYen, lostReason });

    // 保存 → 履歴 → カウンタ の順。保存が失敗したら履歴もカウンタも進めない。
    const saved = await putCompany(updated);

    const activity: Activity = { id: newId(), companyId: saved.id, kind, note, at };
    await addActivity(activity);
    await bumpDay(kind, today);

    return json({ company: saved, activity }, 200, ch);
  } catch (e) {
    if (e instanceof KvNotConfigured) {
      return json({ error: 'STORAGE_NOT_CONFIGURED', message: '保存先 (Upstash Redis) が未設定です。' }, 503, ch);
    }
    return json({ error: 'INTERNAL', message: errMessage(e).slice(0, 200) }, 500, ch);
  }
}
