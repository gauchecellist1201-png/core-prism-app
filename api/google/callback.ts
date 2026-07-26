// ============================================================
// GET /api/google/callback?code=&state=
//
// Google の同意画面から戻ってくる先。state で uid を復元し、code を
// access_token + **refresh_token** に交換して Upstash に保存する。
// refresh_token が取れなかった場合は「成功」にしない（それを保存しても
// 1時間で切れる旧状態に戻るだけなので、原因を伝えてやり直させる）。
//
// Google は redirect_uri にクエリ付きURLを許さないため、oauth.ts とは
// 別ファイルの固定パスにしている。
// ============================================================

export const config = { runtime: 'edge' };

import {
  G_TOKEN,
  G_USERINFO,
  TOKEN_TTL,
  getClientId,
  getClientSecret,
  getRedirectUri,
  isGoogleConfigured,
  appOrigin,
  stateKey,
  tokKey,
  jsonRes,
  type GoogleOAuthState,
  type StoredGoogleToken,
} from './_shared';
import { isUpstashConfigured, kvGetJSON, kvSetJSON, kvDel } from '../_lib/upstash';

function backToApp(query: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${appOrigin()}/?${query}`, 'Cache-Control': 'no-store' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonRes({ error: 'method-not-allowed' }, 405);
  if (!isGoogleConfigured() || !isUpstashConfigured()) {
    return backToApp('gcal_error=not-configured');
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthErr = url.searchParams.get('error');

  if (oauthErr) return backToApp(`gcal_error=${encodeURIComponent(oauthErr)}`);
  if (!code || !state) return backToApp('gcal_error=missing-code-or-state');

  // state 検証（必須）。一度使ったら即削除して再利用を防ぐ。
  let st: GoogleOAuthState | null = null;
  try {
    st = await kvGetJSON<GoogleOAuthState>(stateKey(state));
  } catch {
    return backToApp('gcal_error=state-lookup-failed');
  }
  if (!st?.uid) return backToApp('gcal_error=state-mismatch');
  try { await kvDel(stateKey(state)); } catch { /* best-effort */ }

  try {
    const body = new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    });
    const tokenResp = await fetch(G_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text().catch(() => '');
      console.error('[google callback] token exchange failed:', tokenResp.status, t.slice(0, 300));
      return backToApp('gcal_error=token-exchange-failed');
    }
    const data = (await tokenResp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    // ★refresh_token が無いと「毎回つなぎ直し」に逆戻りするので成功にしない。
    //   （同じ Google アカウントで再認可すると省略されることがあるため prompt=consent を付けている）
    if (!data.refresh_token) {
      return backToApp('gcal_error=no-refresh-token');
    }

    // メールアドレス等（任意・失敗しても保存は続行）
    let email: string | undefined;
    let name: string | undefined;
    let picture: string | undefined;
    try {
      if (data.access_token) {
        const me = await fetch(G_USERINFO, { headers: { Authorization: `Bearer ${data.access_token}` } });
        if (me.ok) {
          const j = (await me.json()) as { email?: string; name?: string; picture?: string };
          email = j.email; name = j.name; picture = j.picture;
        }
      }
    } catch { /* 任意項目 */ }

    const stored: StoredGoogleToken = {
      refresh_token: data.refresh_token,
      access_token: data.access_token,
      expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000,
      email,
      name,
      picture,
      connected_at: new Date().toISOString(),
    };
    await kvSetJSON(tokKey(st.uid), stored, TOKEN_TTL);

    return backToApp('gcal_connected=1');
  } catch (e) {
    console.error('[google callback] error:', e);
    return backToApp('gcal_error=internal');
  }
}
