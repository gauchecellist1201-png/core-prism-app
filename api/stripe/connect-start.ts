// ============================================================
// /api/stripe/connect-start — Stripe Connect OAuth フロー開始
//
// オーナー指示 (2026-05-26):
//   rk_live_ を手動コピペさせるのはユーザー摩擦が大き過ぎる。
//   「Stripe をつなぐ」ボタン押下 → Stripe 公式の許可画面 → 戻ってきたら完了
//   というワンタップ体験にする。
//
// フロー:
//   1. クライアントが GET /api/stripe/connect-start を叩く
//   2. このエンドポイントが state (CSRF 対策) を発行
//   3. https://connect.stripe.com/oauth/authorize?... に 302 redirect
//   4. ユーザーが Stripe で「許可」 → /api/stripe/connect-callback?code=...&state=...
//   5. callback が code→access_token 交換 → クライアントに渡す
//
// 必須 env: STRIPE_CONNECT_CLIENT_ID (ca_xxxxx, オーナーが Stripe ダッシュボードで発行)
// ============================================================

export const config = { runtime: 'edge' };

const STRIPE_AUTHORIZE = 'https://connect.stripe.com/oauth/authorize';

function makeState(): string {
  // 簡易 state — 32 文字のランダム英数字。CSRF 防止用。
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) {
    // env 未設定 → クライアントに案内 + 旧 rk_live_ 入力フォームへ誘導
    return new Response(JSON.stringify({
      error: 'CONNECT_NOT_CONFIGURED',
      message: 'Stripe Connect の連携準備中です。今は「読み取り専用キー」貼り付けでも利用可能。',
      fallback: 'manual_key',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  // origin を組み立て (本番 / プレビュー / localhost で動くように)
  const origin = req.headers.get('origin') || (url.protocol + '//' + url.host);
  const redirectUri = `${origin}/api/stripe/connect-callback`;

  const state = makeState();

  // OAuth URL を組み立て
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_only',
    redirect_uri: redirectUri,
    state,
    // Stripe Express は素早い、Standard は既存アカウントを使いたい人向け
    // ここでは「既存の Stripe アカウントを持っているユーザー」を想定 → Standard。
    'stripe_user[business_type]': 'company',
  });

  const authorizeUrl = `${STRIPE_AUTHORIZE}?${params.toString()}`;

  // 302 redirect — state を short-lived cookie に保存 (CSRF 検証用)
  return new Response(null, {
    status: 302,
    headers: {
      'Location': authorizeUrl,
      'Set-Cookie': `stripe_connect_state=${state}; Path=/api/stripe; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    },
  });
}
