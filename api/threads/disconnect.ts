// ============================================================
// POST /api/threads/disconnect   body: { uid: string }
//
// th:tok:<uid> を削除して連携を解除する。
// ============================================================

export const config = { runtime: 'edge' };

import { tokKey, jsonRes } from './_shared';
import { isUpstashConfigured, kvDel } from '../_lib/upstash';

interface Body {
  uid?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonRes({ error: 'method-not-allowed' }, 405);
  if (!isUpstashConfigured()) {
    // 保存先が無い＝そもそも連携も無い。冪等に成功扱い。
    return jsonRes({ ok: true });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonRes({ error: 'bad-request', message: '送信データの形式が不正です。' }, 400);
  }
  const uid = (body.uid || '').trim();
  if (!uid) return jsonRes({ error: 'bad-request', message: 'uid がありません。' }, 400);

  try {
    await kvDel(tokKey(uid));
  } catch {
    return jsonRes({ error: 'storage-error', message: '連携解除に失敗しました。時間をおいて再度お試しください。' }, 502);
  }
  return jsonRes({ ok: true });
}
