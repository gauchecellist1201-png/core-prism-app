// ============================================================
// POST /api/threads/data-deletion
// Metaの「データ削除リクエストURL」必須項目を満たすエンドポイント。
// Metaの仕様では JSON { url, confirmation_code } を返す必要がある。
// （本アプリはThreadsトークンのみ保持し、ユーザーが連携解除すれば即破棄される設計。）
// ============================================================

export const config = { runtime: 'edge' };

import { jsonRes } from './_shared';

const BASE = 'https://core-prism-app.vercel.app/api/threads/data-deletion';

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    return jsonRes({ ok: true, hint: 'Threads data deletion callback' });
  }
  try { await req.text(); } catch { /* noop */ }
  // 追跡用の確認コード（端末非依存・衝突回避のためランダム）。
  const code = 'thdel_' + Math.random().toString(36).slice(2, 12);
  return jsonRes({ url: `${BASE}?code=${code}`, confirmation_code: code });
}
