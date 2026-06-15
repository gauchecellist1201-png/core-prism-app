// ============================================================
// GET /api/x/start?uid=<匿名ID>
//
// PKCE(verifier/challenge S256) と state を生成し x:st:<state>={uid,verifier}
// を TTL600 で保存 → X 認可 URL へ 302 リダイレクト。
// X_CLIENT_ID / X_CLIENT_SECRET が未設定なら 503 {error:'not-configured'}。
// ============================================================

export const config = { runtime: 'edge' };

import {
  X_AUTHORIZE,
  X_SCOPES,
  STATE_TTL,
  getClientId,
  getRedirectUri,
  isXConfigured,
  randStr,
  sha256base64url,
  stateKey,
  jsonRes,
} from './_shared';
import { isUpstashConfigured, kvSetJSON } from '../_lib/upstash';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonRes({ error: 'method-not-allowed' }, 405);

  if (!isXConfigured()) {
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

  const verifier = randStr(64);
  const challenge = await sha256base64url(verifier);
  const state = randStr(32);

  try {
    await kvSetJSON(stateKey(state), { uid, verifier }, STATE_TTL);
  } catch {
    return jsonRes({ error: 'storage-error', message: '連携の準備に失敗しました。時間をおいて再度お試しください。' }, 502);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: X_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${X_AUTHORIZE}?${params.toString()}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
