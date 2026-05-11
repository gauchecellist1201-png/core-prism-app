// ============================================================
// POST /api/integrations/inbound — Slack スラッシュコマンド受信
//
// SLACK_SIGNING_SECRET が未設定の場合は 503 を返す。
// 署名検証 + Claude 呼び出しは次スプリントで実装。
// ============================================================

export const config = { runtime: 'edge' };

export default async function handler(_req: Request): Promise<Response> {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    return new Response('NOT_CONFIGURED', { status: 503 });
  }

  // 署名検証 + Claude 呼び出しは次スプリントで実装
  return new Response('NOT_CONFIGURED', { status: 503 });
}
