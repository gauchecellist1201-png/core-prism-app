// ============================================================
// GET /api/threads/callback?code=&state=
//
// state で {uid} を復元 → Threads トークン endpoint へ code 交換（short-lived）
// → th_exchange_token で 60 日長期トークンに交換 → me で username 取得
// → th:tok:<uid> 保存 → Prism へ 302。
// 失敗時も Prism へ /?threads_error=... で戻す（silent fail 禁止）。
// ============================================================

export const config = { runtime: 'edge' };

import {
  TH_TOKEN,
  TH_LONG_TOKEN,
  TH_ME,
  TOKEN_TTL,
  getAppId,
  getAppSecret,
  getRedirectUri,
  isThreadsConfigured,
  appOrigin,
  stateKey,
  tokKey,
  jsonRes,
  type OAuthState,
  type StoredThreadsToken,
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
  if (!isThreadsConfigured() || !isUpstashConfigured()) {
    return backToApp('threads_error=not-configured');
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthErr = url.searchParams.get('error');

  if (oauthErr) return backToApp(`threads_error=${encodeURIComponent(oauthErr)}`);
  if (!code || !state) return backToApp('threads_error=missing-code-or-state');

  // state 検証（必須）。一度使ったら即削除して再利用を防ぐ。
  let st: OAuthState | null = null;
  try {
    st = await kvGetJSON<OAuthState>(stateKey(state));
  } catch {
    return backToApp('threads_error=state-lookup-failed');
  }
  if (!st || !st.uid) {
    return backToApp('threads_error=state-mismatch');
  }
  try { await kvDel(stateKey(state)); } catch { /* best-effort */ }

  try {
    // 1) code → short-lived token 交換（form-urlencoded）
    const body = new URLSearchParams({
      client_id: getAppId(),
      client_secret: getAppSecret(),
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(),
      code,
    });
    const tokenResp = await fetch(TH_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text().catch(() => '');
      console.error('[threads callback] token exchange failed:', tokenResp.status, t.slice(0, 300));
      return backToApp('threads_error=token-exchange-failed');
    }
    const short = (await tokenResp.json()) as { access_token?: string; user_id?: string | number };
    if (!short.access_token) return backToApp('threads_error=no-access-token');

    // 2) short-lived → 60 日の長期トークンに交換
    let accessToken = short.access_token;
    let expiresIn = 60 * 60 * 24 * 60; // 60 日（既定）
    try {
      const longUrl = `${TH_LONG_TOKEN}?grant_type=th_exchange_token&client_secret=${encodeURIComponent(getAppSecret())}&access_token=${encodeURIComponent(short.access_token)}`;
      const longResp = await fetch(longUrl, { method: 'GET' });
      if (longResp.ok) {
        const long = (await longResp.json()) as { access_token?: string; expires_in?: number };
        if (long.access_token) {
          accessToken = long.access_token;
          if (Number(long.expires_in) > 0) expiresIn = Number(long.expires_in);
        }
      } else {
        const t = await longResp.text().catch(() => '');
        console.error('[threads callback] long-lived exchange failed:', longResp.status, t.slice(0, 300));
      }
    } catch (e) {
      // 長期化に失敗しても short-lived で保存は続行（投稿は可能）。
      console.error('[threads callback] long-lived exchange error:', e);
    }

    // 3) me で username 取得（失敗しても保存は続行）
    let username: string | undefined;
    let userId: string | undefined = short.user_id != null ? String(short.user_id) : undefined;
    try {
      const meResp = await fetch(`${TH_ME}?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
      if (meResp.ok) {
        const me = (await meResp.json()) as { id?: string; username?: string };
        username = me.username;
        if (me.id) userId = String(me.id);
      }
    } catch { /* username は任意 */ }

    // 4) th:tok:<uid> 保存
    const stored: StoredThreadsToken = {
      access_token: accessToken,
      expires_at: Date.now() + expiresIn * 1000,
      username,
      user_id: userId,
    };
    await kvSetJSON(tokKey(st.uid), stored, TOKEN_TTL);

    return backToApp('threads_connected=1');
  } catch (e) {
    console.error('[threads callback] error:', e);
    return backToApp('threads_error=internal');
  }
}
