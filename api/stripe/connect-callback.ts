// ============================================================
// /api/stripe/connect-callback — Stripe Connect OAuth コールバック
//
// Stripe で「許可」を押すと:
//   https://core-prism-app.vercel.app/api/stripe/connect-callback?code=ac_XXX&state=YYY
// に redirect される。ここで:
//   1. state を cookie と照合 (CSRF 防止)
//   2. code を access_token に交換 (POST https://connect.stripe.com/oauth/token)
//   3. access_token を URL fragment (#stripe_token=…) でクライアントに渡す
//   4. ダッシュボードに戻す (HTML response で auto-redirect)
//
// 必須 env:
//   STRIPE_SECRET_KEY (既存)
//   STRIPE_CONNECT_CLIENT_ID (新規)
// ============================================================

export const config = { runtime: 'edge' };

const STRIPE_TOKEN = 'https://connect.stripe.com/oauth/token';

function htmlRedirect(targetWithFragment: string, statusText: string): Response {
  // フラグメントを付けて遷移する小さな HTML
  // (フラグメントはサーバには送信されないので、access_token を URL に乗せる安全な方法)
  const safeTarget = targetWithFragment.replace(/"/g, '&quot;');
  const safeText = statusText.replace(/</g, '&lt;');
  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>連携処理中…</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif; background:#0E0E12; color:#F0EFF2; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .wrap { text-align:center; padding:2rem; max-width:380px; }
  .spinner { width:42px; height:42px; margin:0 auto 1rem; border-radius:50%; border:3px solid rgba(99,91,255,0.2); border-top-color:#635BFF; animation:spin 0.8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  h1 { font-size:1rem; font-weight:600; margin:0 0 0.5rem; }
  p { font-size:0.85rem; opacity:0.7; margin:0; line-height:1.5; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="spinner" aria-hidden="true"></div>
    <h1>${safeText}</h1>
    <p>自動で戻ります…</p>
  </div>
  <script>
    // 1.0 秒後にハッシュ付きで本体へ遷移 (フラグメントはサーバに送られないので token が漏れない)
    setTimeout(function() {
      window.location.replace("${safeTarget}");
    }, 800);
  </script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function htmlError(message: string): Response {
  const safe = message.replace(/</g, '&lt;');
  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>連携に失敗しました</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif; background:#0E0E12; color:#F0EFF2; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .wrap { text-align:center; padding:2rem; max-width:420px; }
  h1 { font-size:1.1rem; font-weight:700; margin:0 0 0.6rem; color:#FCA5A5; }
  p { font-size:0.88rem; opacity:0.85; line-height:1.6; margin:0 0 1.5rem; }
  a { display:inline-block; padding:10px 20px; border-radius:10px; background:#635BFF; color:#fff; text-decoration:none; font-weight:600; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Stripe 連携に失敗しました</h1>
    <p>${safe}</p>
    <a href="/">CORE Prism に戻る</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  // ユーザーが Stripe 側で「拒否」した場合
  if (error) {
    return htmlError(`Stripe からエラー: ${errorDesc || error}`);
  }

  if (!code || !state) {
    return htmlError('認可情報が不足しています。もう一度お試しください。');
  }

  // state 検証 (cookie と一致するか)
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieMap = Object.fromEntries(
    cookieHeader.split(';').map(s => s.trim().split('=').map(decodeURIComponent))
  );
  const expectedState = cookieMap['stripe_connect_state'];
  if (!expectedState || expectedState !== state) {
    return htmlError('セキュリティ検証に失敗しました (state 不一致)。もう一度はじめからやり直してください。');
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return htmlError('サーバ設定に問題があります (STRIPE_SECRET_KEY 未設定)。管理者へご連絡ください。');
  }

  // code → access_token 交換
  try {
    const tokenRes = await fetch(STRIPE_TOKEN, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return htmlError(`トークン交換失敗 (${tokenRes.status}): ${errText.slice(0, 200)}`);
    }

    const data = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      livemode?: boolean;
      stripe_user_id: string;
      scope: string;
      token_type: string;
    };

    if (!data.access_token) {
      return htmlError('Stripe から有効なトークンが返りませんでした。');
    }

    // セキュリティ: token を URL fragment (#) で渡す。フラグメントはサーバに送信されない。
    // クライアント JS が読み取って localStorage に保存する。
    const fragment = new URLSearchParams({
      stripe_connect: '1',
      token: data.access_token,
      stripe_user_id: data.stripe_user_id,
      livemode: data.livemode ? '1' : '0',
    }).toString();

    const target = `/?${new URLSearchParams({ stripe_connected: '1' }).toString()}#${fragment}`;

    // state cookie を削除 (使い終わったので)
    const response = htmlRedirect(target, '✓ Stripe をつなぎました');
    response.headers.append('Set-Cookie', 'stripe_connect_state=; Path=/api/stripe; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    return response;
  } catch (e: any) {
    return htmlError(`通信エラー: ${e?.message || 'unknown'}`);
  }
}
