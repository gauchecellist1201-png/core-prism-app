// ============================================================
// POST /api/integrations/line-info  (Node.js ランタイム)
//
// ★なぜ追加したか（2026-07-26 オーナー報告「userId が何度やっても接続されない」の根治）
//   これまで Prism の LINE 連携は「userId を人手で貼って、実際に push が1通成功すること」
//   を接続条件にしていた。そのため
//     ・userId のコピペに不可視文字が混ざる
//     ・プロバイダ違いの userId を貼る
//     ・その公式アカウントを友だち追加していない
//   のどれか1つでも起きると接続できなかった。
//   Resonance では `GET /v2/bot/info` にトークンを通すだけで接続が完了しており
//   （resonancebot-work/src/lib/line.ts の getBotInfo）、userId の人手入力は不要。
//   Prism もその方式に合わせるためのプロキシ。LINE API はブラウザから直接叩けない
//   （CORS 未対応）ので、サーバー経由にする必要がある。
//
// 入力: ヘッダー x-line-token = チャネルアクセストークン (長期)
// 出力:
//   200 { ok: true, basicId, displayName, botUserId, pictureUrl? }
//   400 { error: 'INVALID_INPUT', message }
//   401 { error: 'TOKEN_INVALID', message }
//   503 { error: 'LINE_UNAVAILABLE', message }
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  // line-push.ts と完全に同じ前処理（スマホのコピペで混入する不可視文字を除去）
  const clean = (v: unknown) => String(v || '').replace(/[\u200B-\u200D\uFEFF\s\u3000]/g, '');
  const token = clean(req.headers['x-line-token']);

  if (!token || token.length < 50) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message:
        'アクセストークンが空 / 短すぎます。LINE Developers の「チャネルアクセストークン (長期)」を貼り付けてください。',
    });
  }

  try {
    const r = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    });

    if (r.status === 200) {
      const j = (await r.json().catch(() => ({}))) as {
        basicId?: string;
        displayName?: string;
        userId?: string;
        pictureUrl?: string;
      };
      return res.status(200).json({
        ok: true,
        basicId: j.basicId || '',
        displayName: j.displayName || '',
        botUserId: j.userId || '',
        pictureUrl: j.pictureUrl || '',
      });
    }
    if (r.status === 401 || r.status === 403) {
      return res.status(401).json({
        error: 'TOKEN_INVALID',
        message:
          'アクセストークンが無効か、期限切れです。LINE Developers Console の「Messaging API 設定」→「チャネルアクセストークン(長期)」で発行し直して、全文を貼り直してください。',
      });
    }
    return res.status(503).json({
      error: 'LINE_UNAVAILABLE',
      message: `LINE 側が一時的に応答していません (HTTP ${r.status})。少し待ってからもう一度お試しください。`,
    });
  } catch (e: any) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return res.status(503).json({
      error: 'LINE_UNAVAILABLE',
      message: timedOut
        ? 'LINE への確認がタイムアウトしました。少し待ってからもう一度お試しください。'
        : 'LINE に接続できませんでした。トークンをご確認ください。',
    });
  }
}
