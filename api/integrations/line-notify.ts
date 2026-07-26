// ============================================================
// POST /api/integrations/line-notify  (Node.js ランタイム)
//
// Prism の「AI役員がやったこと」を公式LINEへ届けるための送信口。
//
// ★なぜ line-push とは別に作るか（オーナー要望 2026-07-26）
//   line-push は宛先 userId が必須。しかし 2026-07-26 の接続まわりの修正で
//   「トークンだけで接続完了」にしたため、userId を持っていない人がいる。
//   userId があれば push（その人だけに届く）、無ければ broadcast（友だち全員）に
//   自動で切り替えて、どちらの接続状態でも通知が届くようにする。
//
// ★LINEの無料枠について（正直に）
//   push も broadcast も、LINE公式アカウントの月間無料メッセージ数を消費する。
//   （届いたメッセージへの「返信」だけが無料枠を使わない仕組みで、
//     こちらから送るこの通知は枠を使う。）
//   そのため呼び出し側で「重要なものだけ」に絞ること。
//
// 入力:
//   ヘッダー: x-line-token  = チャネルアクセストークン (長期)
//   ヘッダー: x-line-userid = 送信先 userId（任意。無ければ broadcast）
//   body    : { text: string }
// 出力:
//   200 { ok: true, mode: 'push' | 'broadcast' }
//   400/401/503 { error, message }
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  // スマホのコピペで混入する不可視文字を除去（line-push.ts と同じ前処理）
  const clean = (v: unknown) => String(v || '').replace(/[\u200B-\u200D\uFEFF\s\u3000]/g, '');
  const token = clean(req.headers['x-line-token']);
  const userId = clean(req.headers['x-line-userid']);

  if (!token || token.length < 50) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'LINEのアクセストークンが未設定です。連携センターの「LINE 公式アカウント」からつないでください。',
    });
  }

  let body: { text?: string } = {};
  if (req.body && typeof req.body === 'object') body = req.body as { text?: string };
  else if (typeof req.body === 'string') { try { body = JSON.parse(req.body); } catch { /* */ } }

  const text = String(body.text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: '送信するテキストが空です。' });
  }
  const safeText = text.length > 4900 ? text.slice(0, 4900) + '…' : text;

  // userId があれば その人だけに、無ければ 友だち全員へ。
  const usePush = /^U[0-9a-fA-F]{20,}$/.test(userId);
  const url = usePush
    ? 'https://api.line.me/v2/bot/message/push'
    : 'https://api.line.me/v2/bot/message/broadcast';
  const payload = usePush
    ? { to: userId, messages: [{ type: 'text', text: safeText }] }
    : { messages: [{ type: 'text', text: safeText }] };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });

    if (r.status === 200) {
      return res.status(200).json({ ok: true, mode: usePush ? 'push' : 'broadcast' });
    }
    if (r.status === 401) {
      return res.status(401).json({
        error: 'TOKEN_INVALID',
        message: 'LINEのアクセストークンが無効です。連携センターでつなぎ直してください。',
      });
    }
    if (r.status === 429) {
      return res.status(429).json({
        error: 'QUOTA_EXCEEDED',
        message: '今月のLINE無料メッセージ数を使い切りました。来月まで通知は止まります（LINE公式アカウントの上限です）。',
      });
    }
    let j: { message?: string } = {};
    try { j = await r.json(); } catch { /* */ }
    return res.status(503).json({
      error: 'LINE_UNAVAILABLE',
      message: `LINEへ送れませんでした (HTTP ${r.status})${j?.message ? `: ${j.message}` : ''}`,
    });
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name;
    const timedOut = name === 'TimeoutError' || name === 'AbortError';
    return res.status(503).json({
      error: 'LINE_UNAVAILABLE',
      message: timedOut ? 'LINEへの送信がタイムアウトしました。' : 'LINEに接続できませんでした。',
    });
  }
}
