// ============================================================
// GET /api/instagram/oauth-callback
//
// Facebook OAuth ダイアログから戻ってきた code を long-lived
// access token に交換し、IG business account を解決した上で
// HttpOnly Cookie に保存して return_to へリダイレクト。
// ============================================================

export const config = { runtime: 'edge' };

function originOf(req: Request): string {
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(req.url).origin;
}

function readCookies(req: Request): Record<string, string> {
  const raw = req.headers.get('cookie') || '';
  const out: Record<string, string> = {};
  raw.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function errorRedirect(origin: string, returnTo: string, code: string): Response {
  const target = new URL(returnTo.startsWith('http') ? returnTo : `${origin}${returnTo}`);
  target.searchParams.set('ig_oauth', 'error');
  target.searchParams.set('reason', code);
  const headers = new Headers({ Location: target.toString() });
  // 使い終わった一時 Cookie をクリア
  const clear = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  headers.append('Set-Cookie', `ig_oauth_state=; ${clear}`);
  headers.append('Set-Cookie', `ig_oauth_return=; ${clear}`);
  return new Response(null, { status: 302, headers });
}

export default async function handler(req: Request): Promise<Response> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return new Response('NOT_CONFIGURED', { status: 503 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const cookies = readCookies(req);
  const expectedState = cookies['ig_oauth_state'];
  const returnTo = decodeURIComponent(cookies['ig_oauth_return'] || '/iris');
  const origin = originOf(req);

  if (oauthError) return errorRedirect(origin, returnTo, oauthError);
  if (!code || !state) return errorRedirect(origin, returnTo, 'missing_code_or_state');
  if (!expectedState || expectedState !== state) {
    return errorRedirect(origin, returnTo, 'state_mismatch');
  }

  const redirectUri = `${origin}/api/instagram/oauth-callback`;

  try {
    // 1) code → short-lived access token
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    const tokenResp = await fetch(tokenUrl.toString());
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      console.error('[ig oauth] token exchange failed:', t);
      return errorRedirect(origin, returnTo, 'token_exchange_failed');
    }
    const tokenJson = (await tokenResp.json()) as { access_token?: string };
    const shortToken = tokenJson.access_token;
    if (!shortToken) return errorRedirect(origin, returnTo, 'no_access_token');

    // 2) short → long-lived (60 日)
    const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', appId);
    longUrl.searchParams.set('client_secret', appSecret);
    longUrl.searchParams.set('fb_exchange_token', shortToken);
    const longResp = await fetch(longUrl.toString());
    const longJson = (await longResp.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    const longToken = longJson.access_token || shortToken;
    const expiresIn = longJson.expires_in || 60 * 60 * 24 * 60;

    // 3) Page 一覧から IG Business Account を解決
    const pagesUrl = new URL('https://graph.facebook.com/v21.0/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account');
    pagesUrl.searchParams.set('access_token', longToken);
    const pagesResp = await fetch(pagesUrl.toString());
    const pagesJson = (await pagesResp.json()) as {
      data?: {
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
      }[];
    };
    const firstPage = (pagesJson.data || []).find((p) => p.instagram_business_account?.id);
    if (!firstPage || !firstPage.instagram_business_account) {
      return errorRedirect(origin, returnTo, 'no_ig_business_account');
    }
    const igId = firstPage.instagram_business_account.id;
    const pageToken = firstPage.access_token;

    // 4) Cookie 保存 (長期トークン + IG account ID + Page token)
    const cookieAttrs = `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${expiresIn}`;
    const headers = new Headers();
    headers.append('Set-Cookie', `ig_access_token=${pageToken}; ${cookieAttrs}`);
    headers.append('Set-Cookie', `ig_user_token=${longToken}; ${cookieAttrs}`);
    headers.append('Set-Cookie', `ig_account_id=${igId}; ${cookieAttrs}`);
    // クライアントが「連携済み」を判定するための非 HttpOnly フラグ
    headers.append(
      'Set-Cookie',
      `ig_connected=1; Path=/; Secure; SameSite=Lax; Max-Age=${expiresIn}`,
    );
    // 一時 Cookie をクリア
    const clear = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
    headers.append('Set-Cookie', `ig_oauth_state=; ${clear}`);
    headers.append('Set-Cookie', `ig_oauth_return=; ${clear}`);

    const target = new URL(returnTo.startsWith('http') ? returnTo : `${origin}${returnTo}`);
    target.searchParams.set('ig_oauth', 'ok');
    headers.set('Location', target.toString());
    return new Response(null, { status: 302, headers });
  } catch (e) {
    console.error('[ig oauth] callback error:', e);
    return errorRedirect(origin, returnTo, 'internal_error');
  }
}
