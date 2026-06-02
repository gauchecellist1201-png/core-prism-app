// ============================================================
// POST /api/integrations/line-push
//
// 公式LINEアカウント (LINE Messaging API) で push 送信する。
// LINE Notify は 2025/3/31 に終了したため、その代替として実装。
//
// 入力:
//   ヘッダー: x-line-token  = チャネルアクセストークン (長期)
//   ヘッダー: x-line-userid = 送信先 userId (Uxxxxxxx...)
//   body  : { text: string, test?: boolean }
//
// 出力:
//   200 { ok: true, channelName?: string }
//   400 { error: 'INVALID_INPUT', message }
//   401 { error: 'TOKEN_INVALID', message }  ← ユーザーに「再発行を」と案内
//   403 { error: 'USER_NOT_FRIEND', message } ← Bot を友だち追加し直してと案内
//   503 { error: 'LINE_UNAVAILABLE' }
//
// 設計方針:
//   - サーバー側で公式LINEクレデンシャルは持たない (各ユーザーが自分のチャネル)
//   - 動作確認用に「test=true」が来たら自己診断メッセージを送る
// ============================================================

export const config = { runtime: 'edge' };

interface PushBody {
  text?: string;
  test?: boolean;
}

const TEST_MESSAGE = '✅ CORE / GAUCHE Cello との連携テストです。\nこのメッセージが届いたら、AI からの提案やリマインドが LINE で受け取れる状態になっています。';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonRes(405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const token = (req.headers.get('x-line-token') || '').trim();
  const userId = (req.headers.get('x-line-userid') || '').trim();

  if (!token || token.length < 50) {
    return jsonRes(400, { error: 'INVALID_INPUT', message: 'アクセストークンが空 / 短すぎます。LINE Developers の「チャネルアクセストークン (長期)」を貼り付けてください。' });
  }
  if (!userId || !/^U[0-9a-f]{20,}$/.test(userId)) {
    return jsonRes(400, { error: 'INVALID_INPUT', message: 'userId が空 / 形式が違います。"U" で始まる 33 文字前後の文字列を貼り付けてください。' });
  }

  let body: PushBody = {};
  try {
    body = await req.json();
  } catch { /* */ }

  const text = (body.test ? TEST_MESSAGE : (body.text || '')).trim();
  if (!text) {
    return jsonRes(400, { error: 'INVALID_INPUT', message: '送信するテキストが空です。' });
  }
  // LINE Messaging API は 1 メッセージ 5000 文字まで
  const safeText = text.length > 4900 ? text.slice(0, 4900) + '…' : text;

  // ── LINE Messaging API push 呼び出し ─────────────────
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: safeText }],
      }),
    });

    if (r.status === 200) {
      // 成功
      return jsonRes(200, { ok: true });
    }
    if (r.status === 401) {
      return jsonRes(401, {
        error: 'TOKEN_INVALID',
        message: 'アクセストークンが無効です。LINE Developers Console で「再発行」して貼り直してください。',
      });
    }
    if (r.status === 403) {
      return jsonRes(403, {
        error: 'USER_NOT_FRIEND',
        message: 'この userId の方が公式アカウントを「友だち追加」していないか、ブロック中です。QR コードからもう一度友だち追加してください。',
      });
    }
    if (r.status === 400) {
      let j: { message?: string } = {};
      try { j = await r.json(); } catch { /* */ }
      return jsonRes(400, {
        error: 'INVALID_INPUT',
        message: `LINE から拒否されました: ${j?.message || 'リクエスト形式エラー'}`,
      });
    }
    // 429 / 5xx etc.
    return jsonRes(503, { error: 'LINE_UNAVAILABLE', message: `LINE 側が一時的に応答していません (HTTP ${r.status})。少し待ってからもう一度。` });
  } catch (e) {
    return jsonRes(503, { error: 'LINE_UNAVAILABLE', message: 'LINE に接続できませんでした。ネットワーク状況をご確認ください。' });
  }
}

function jsonRes(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
