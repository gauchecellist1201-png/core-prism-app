// ============================================================
// POST /api/x/post   body: { uid: string, tweets: string[] }
//
// トークン読込 → 期限切れなら refresh_token で更新し保存 →
// POST https://api.twitter.com/2/tweets を順に投稿（2本目以降は
// reply.in_reply_to_tweet_id で前の id に連結＝スレッド）→
// 投稿 id 配列と URL を返す。
//
// エラーは必ず日本語の意味あるメッセージ（silent fail 禁止）:
//   401/403 (失効) → { error:'reauth' }
//   429        → { error:'rate', message:'…無料枠は月500件…' }
// ============================================================

export const config = { runtime: 'edge' };

import { isXConfigured, jsonRes } from './_shared';
import { isUpstashConfigured } from '../_lib/upstash';
import { postTweetsForUid } from './_postCore';

interface PostBody {
  uid?: string;
  tweets?: unknown;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonRes({ error: 'method-not-allowed', message: 'POST で呼び出してください。' }, 405);
  if (!isXConfigured() || !isUpstashConfigured()) {
    return jsonRes({ error: 'not-configured', message: 'Xの自動投稿はまだ設定されていません。' }, 503);
  }

  let parsed: PostBody;
  try {
    parsed = (await req.json()) as PostBody;
  } catch {
    return jsonRes({ error: 'bad-request', message: '送信データの形式が不正です。' }, 400);
  }

  const uid = (parsed.uid || '').trim();
  const tweets = Array.isArray(parsed.tweets) ? parsed.tweets.map((t) => String(t ?? '')) : [];

  const result = await postTweetsForUid(uid, tweets);
  const statusMap: Record<string, number> = {
    'bad-request': 400, empty: 400, 'too-many': 400,
    'storage-error': 502, reauth: 401, rate: 429, 'post-failed': 502, network: 502,
  };
  if (!result.ok) return jsonRes(result, statusMap[result.error || ''] || 502);
  return jsonRes(result);
}
