// ============================================================
// GET /api/threads/start?uid=<匿名ID>
//
// state を生成し th:st:<state>={uid} を TTL600 で保存 → Threads 認可 URL へ
// 302 リダイレクト。THREADS_APP_ID / THREADS_APP_SECRET が未設定なら
// 503 {error:'not-configured'}。
// ============================================================

export const config = { runtime: 'edge' };

import {
  TH_AUTHORIZE,
  TH_SCOPES,
  STATE_TTL,
  getAppId,
  getRedirectUri,
  isThreadsConfigured,
  randStr,
  stateKey,
  jsonRes,
} from './_shared';
import { isUpstashConfigured, kvSetJSON } from '../_lib/upstash';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonRes({ error: 'method-not-allowed' }, 405);

  if (!isThreadsConfigured()) {
    return jsonRes({ error: 'not-configured' }, 503);
  }
  if (!isUpstashConfigured()) {
    return jsonRes({ error: 'storage-unavailable', message: '連携用の保存先が未設定です。' }, 503);
  }

  const url = new URL(req.url);
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid || uid.length > 100) {
    return jsonRes({ error: 'bad-uid', message: 'uid が不正です。' }, 400);
  }

  const state = randStr(32);

  try {
    await kvSetJSON(stateKey(state), { uid }, STATE_TTL);
  } catch {
    return jsonRes({ error: 'storage-error', message: '連携の準備に失敗しました。時間をおいて再度お試しください。' }, 502);
  }

  const params = new URLSearchParams({
    client_id: getAppId(),
    redirect_uri: getRedirectUri(),
    scope: TH_SCOPES,
    response_type: 'code',
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${TH_AUTHORIZE}?${params.toString()}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
