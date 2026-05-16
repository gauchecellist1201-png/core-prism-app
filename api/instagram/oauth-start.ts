// ============================================================
// GET /api/instagram/oauth-start
//
// Meta (Facebook) OAuth ダイアログへリダイレクト。
// Instagram Graph API (Business / Creator) を利用するため
// Facebook Login + Instagram スコープを使う。
//
// CSRF 対策: ランダム state を生成し HttpOnly Cookie に保存。
// callback 側で Cookie の state と query の state を照合する。
// ============================================================

export const config = { runtime: 'edge' };

const SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_read_engagement',
  'pages_show_list',
  'business_management',
].join(',');

function randomState(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function originOf(req: Request): string {
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(req.url).origin;
}

export default async function handler(req: Request): Promise<Response> {
  const appId = process.env.META_APP_ID;
  if (!appId) {
    return new Response('NOT_CONFIGURED: META_APP_ID missing', { status: 503 });
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get('return_to') || '/iris';
  const state = randomState();

  const origin = originOf(req);
  const redirectUri = `${origin}/api/instagram/oauth-callback`;

  // Facebook OAuth ダイアログ
  const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');

  // state と return_to を HttpOnly Cookie で持つ (10 分有効)
  const cookieAttrs = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600';
  const headers = new Headers();
  headers.append('Set-Cookie', `ig_oauth_state=${state}; ${cookieAttrs}`);
  headers.append(
    'Set-Cookie',
    `ig_oauth_return=${encodeURIComponent(returnTo)}; ${cookieAttrs}`,
  );
  headers.set('Location', authUrl.toString());
  return new Response(null, { status: 302, headers });
}
