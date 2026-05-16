// ============================================================
// GET /api/instagram/oauth-status
//
// env META_APP_ID + META_APP_SECRET が両方揃っていれば configured=true。
// Cookie に ig_connected があればユーザー単位で connected=true も返す。
// ============================================================

export const config = { runtime: 'edge' };

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

export default async function handler(req: Request): Promise<Response> {
  const configured =
    Boolean(process.env.META_APP_ID) && Boolean(process.env.META_APP_SECRET);
  const cookies = readCookies(req);
  const connected = Boolean(cookies['ig_connected']);

  return new Response(
    JSON.stringify({ configured, connected, scopes_requested: [
      'instagram_basic',
      'instagram_manage_insights',
      'pages_read_engagement',
      'pages_show_list',
      'business_management',
    ] }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  );
}
