// ============================================================
// POST /api/sales/activity — 営業結果を入れる
//
// body: { id, kind, note?, dealYen?, lostReason?, requestId? }
// 結果を入れた瞬間に「次にやる日」と「次にやること」が必ず入る。
// requestId を付けると、同じ操作は 10 分間 1 回しか適用されない
// (返事が届かなかったときに押し直しても、接触回数や受注額が二重にならない)。
// x-master-key 必須
// ============================================================
import { corsHeaders, errMessage, json, requireMaster } from '../_lib/sales/http';
import { KvNotConfigured } from '../_lib/sales/kv';
import {
  claimRequest, commitActivity, getCompany, newId, nowISO, releaseRequest, todayISO,
} from '../_lib/sales/store';
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

    // 二重適用の防止。札はサーバーが持つ。
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim().slice(0, 80) : '';
    if (requestId && !(await claimRequest(requestId))) {
      return json({
        company,
        activity: null,
        duplicate: true,
        message: 'この操作はすでに記録ずみです。',
      }, 200, ch);
    }

    const at = nowISO();
    const today = todayISO();
    const { company: updated } = applyActivity({ company, kind, today, nowISO: at, dealYen, lostReason });

    // 企業・履歴・カウンタは 1 往復でまとめて書く。
    // 分けて投げると、企業だけ進んで履歴が落ちた時に「やり直すと二重、やり直さないと欠ける」
    // のどちらかになり、どちらも数字が合わなくなる。
    const activity: Activity = { id: newId(), companyId: updated.id, kind, note, at };
    let saved: typeof updated;
    try {
      saved = await commitActivity(updated, activity, today);
    } catch (e) {
      // 適用できなかったら札を返す。返さないと、正しいやり直しまで弾いてしまう。
      await releaseRequest(requestId);
      throw e;
    }

    return json({ company: saved, activity, duplicate: false }, 200, ch);
  } catch (e) {
    if (e instanceof KvNotConfigured) {
      return json({ error: 'STORAGE_NOT_CONFIGURED', message: '保存先 (Upstash Redis) が未設定です。' }, 503, ch);
    }
    return json({ error: 'INTERNAL', message: errMessage(e).slice(0, 200) }, 500, ch);
  }
}
