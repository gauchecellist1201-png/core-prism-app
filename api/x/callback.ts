// ============================================================
// GET /api/x/callback?code=&state=
//
// state で {uid,verifier} を復元 → X トークン endpoint へ code 交換
// (Basic 認証 client_id:client_secret + code_verifier) → access/refresh/expiry
// 取得 → users/me で username 取得 → x:tok:<uid> 保存 → Prism へ 302。
// 失敗時も Prism へ /?x_error=... で戻す（silent fail 禁止）。
// ============================================================

export const config = { runtime: 'edge' };

import {
  X_TOKEN,
  X_ME,
  TOKEN_TTL,
  getRedirectUri,
  isXConfigured,
  basicAuthHeader,
  appOrigin,
  stateKey,
  tokKey,
  jsonRes,
  type OAuthState,
  type StoredXToken,
} from './_shared';
import { isUpstashConfigured, kvGetJSON, kvDel, kvSetJSON } from '../_lib/upstash';

function backToApp(query: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${appOrigin()}/?${query}`,
      'Cache-Control': 'no-store',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonRes({ error: 'method-not-allowed' }, 405);
  if (!isXConfigured() || !isUpstashConfigured()) {
    return backToApp('x_error=not-configured');
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthErr = url.searchParams.get('error');

  if (oauthErr) return backToApp(`x_error=${encodeURIComponent(oauthErr)}`);
  if (!code || !state) return backToApp('x_error=missing-code-or-state');

  // state 検証（必須）。一度使ったら即削除して再利用を防ぐ。
  let st: OAuthState | null = null;
  try {
    st = await kvGetJSON<OAuthState>(stateKey(state));
  } catch {
    return backToApp('x_error=state-lookup-failed');
  }
  if (!st || !st.uid || !st.verifier) {
    return backToApp('x_error=state-mismatch');
  }
  try { await kvDel(stateKey(state)); } catch { /* best-effort */ }

  try {
    // 1) code → token 交換（confidential client = Basic 認証 + code_verifier）
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: st.verifier,
    });
    const tokenResp = await fetch(X_TOKEN, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text().catch(() => '');
      console.error('[x callback] token exchange failed:', tokenResp.status, t.slice(0, 300));
      return backToApp('x_error=token-exchange-failed');
    }
    const data = (await tokenResp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return backToApp('x_error=no-access-token');

    // 2) users/me で username 取得（失敗しても保存は続行）
    let username: string | undefined;
    let userId: string | undefined;
    try {
      const meResp = await fetch(`${X_ME}?user.fields=username`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (meResp.ok) {
        const me = (await meResp.json()) as { data?: { id?: string; username?: string } };
        username = me.data?.username;
        userId = me.data?.id;
      }
    } catch { /* username は任意 */ }

    // 3) x:tok:<uid> 保存
    const stored: StoredXToken = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (Number(data.expires_in) || 7200) * 1000,
      username,
      user_id: userId,
    };
    await kvSetJSON(tokKey(st.uid), stored, TOKEN_TTL);

    return backToApp('x_connected=1');
  } catch (e) {
    console.error('[x callback] error:', e);
    return backToApp('x_error=internal');
  }
}
