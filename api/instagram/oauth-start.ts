// ============================================================
// GET /api/instagram/oauth-start
//
// Instagram API with Instagram Login の認可ダイアログへリダイレクト。
// インフルエンサーは Instagram (プロアカウント) でログイン→許可するだけ。
// Facebook ページを介さず直接 Instagram と連携できる。
//
// CSRF 対策: ランダム state を生成し HttpOnly Cookie に保存。
// callback 側で Cookie の state と query の state を照合する。
// ============================================================

export const config = { runtime: 'edge' };

// Instagram ログイン用スコープ
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
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
  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    return new Response('NOT_CONFIGURED: INSTAGRAM_APP_ID missing', { status: 503 });
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get('return_to') || '/iris';
  const state = randomState();

  const origin = originOf(req);
  const redirectUri = `${origin}/api/instagram/oauth-callback`;

  // Instagram 認可ダイアログ
  const authUrl = new URL('https://www.instagram.com/oauth/authorize');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);

  // state と return_to を HttpOnly Cookie で持つ (10 分有効)
  const cookieAttrs = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600';
  const headers = new Headers();
  headers.append('Set-Cookie', `ig_oauth_state=${state}; ${cookieAttrs}`);
  headers.append(
    'Set-Cookie',
    `ig_oauth_return=${encodeURIComponent(returnTo)}; ${cookieAttrs}`,
  );
  headers.set('Location', authUrl.toString());
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return new Response(null, { status: 302, headers });
}
