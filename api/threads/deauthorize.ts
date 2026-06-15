// ============================================================
// POST /api/threads/deauthorize
// ユーザーがThreads連携(アプリ許可)を取り消したときにMetaから通知が来る。
// 受け取って200を返すだけ（Metaの「アンインストールコールバックURL」必須項目を満たす）。
// ============================================================

export const config = { runtime: 'edge' };

import { jsonRes } from './_shared';

export default async function handler(req: Request): Promise<Response> {
  // Metaは signed_request を form-post してくる。中身の検証は必須ではないため、
  // 受領して200を返す（連携解除はユーザー側で完了している）。
  if (req.method === 'GET') return jsonRes({ ok: true, hint: 'Threads deauthorize callback' });
  try { await req.text(); } catch { /* noop */ }
  return jsonRes({ ok: true });
}
