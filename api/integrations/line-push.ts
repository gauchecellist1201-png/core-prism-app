// ============================================================
// POST /api/integrations/line-push  (Node.js ランタイム)
//
// 公式LINEアカウント (LINE Messaging API) で push 送信する。
// 旧: Edge ランタイムだと api.line.me への fetch がハングして
//     FUNCTION_INVOCATION_TIMEOUT (504) になる事象があったため、
//     Node ランタイム + AbortSignal タイムアウトに変更 (2026-06-17 修正)。
//
// 入力:
//   ヘッダー: x-line-token  = チャネルアクセストークン (長期)
//   ヘッダー: x-line-userid = 送信先 userId (Uxxxxxxx...)
//   body  : { text?: string, test?: boolean }
//
// 出力:
//   200 { ok: true }
//   400 { error: 'INVALID_INPUT', message }
//   401 { error: 'TOKEN_INVALID', message }
//   403 { error: 'USER_NOT_FRIEND', message }
//   503 { error: 'LINE_UNAVAILABLE', message }
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TEST_MESSAGE =
  '✅ CORE との連携テストです。\nこのメッセージが届いたら、AI からの提案やリマインドが LINE で受け取れる状態になっています。';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const token = String(req.headers['x-line-token'] || '').trim();
  const userId = String(req.headers['x-line-userid'] || '').trim();

  if (!token || token.length < 50) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'アクセストークンが空 / 短すぎます。LINE Developers の「チャネルアクセストークン (長期)」を貼り付けてください。',
    });
  }
  if (!userId || !/^U[0-9a-f]{20,}$/.test(userId)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'userId が空 / 形式が違います。"U" で始まる 33 文字前後の文字列を貼り付けてください。',
    });
  }

  // body は Vercel(node) が自動パース。文字列で来る場合に備えてフォールバック。
  let body: { text?: string; test?: boolean } = {};
  if (req.body && typeof req.body === 'object') body = req.body as any;
  else if (typeof req.body === 'string') { try { body = JSON.parse(req.body); } catch { /* */ } }

  const text = (body.test ? TEST_MESSAGE : (body.text || '')).trim();
  if (!text) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: '送信するテキストが空です。' });
  }
  const safeText = text.length > 4900 ? text.slice(0, 4900) + '…' : text;

  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: safeText }] }),
      // Edge のハング対策: 12 秒で打ち切り (LINE は通常 1 秒以内に応答)
      signal: AbortSignal.timeout(12000),
    });

    if (r.status === 200) {
      return res.status(200).json({ ok: true });
    }
    if (r.status === 401) {
      return res.status(401).json({
        error: 'TOKEN_INVALID',
        message: 'アクセストークンが無効です。LINE Developers Console で「再発行」して貼り直してください。',
      });
    }
    if (r.status === 403) {
      return res.status(403).json({
        error: 'USER_NOT_FRIEND',
        message: 'この userId の方が公式アカウントを「友だち追加」していないか、ブロック中です。QR コードからもう一度友だち追加してください。',
      });
    }
    if (r.status === 400) {
      let j: { message?: string } = {};
      try { j = await r.json(); } catch { /* */ }
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: `LINE から拒否されました: ${j?.message || 'リクエスト形式エラー (userId が間違っている可能性)'}`,
      });
    }
    return res.status(503).json({
      error: 'LINE_UNAVAILABLE',
      message: `LINE 側が一時的に応答していません (HTTP ${r.status})。少し待ってからもう一度。`,
    });
  } catch (e: any) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return res.status(503).json({
      error: 'LINE_UNAVAILABLE',
      message: timedOut
        ? 'LINE への送信がタイムアウトしました。少し待ってからもう一度お試しください。'
        : 'LINE に接続できませんでした。トークンと userId をご確認ください。',
    });
  }
}
